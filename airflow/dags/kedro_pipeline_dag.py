import logging
import os
import sys
import subprocess
import shutil
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python_operator import PythonOperator
from airflow.exceptions import AirflowTaskTimeout
import mlflow
import time
logging.basicConfig(level=logging.INFO)

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'start_date': datetime(2025, 7, 4),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=1),
}

dag = DAG(
    'kedro_pipeline',
    default_args=default_args,
    description='Run Kedro pipeline with 2-minute timeout',
    schedule_interval=timedelta(days=1),
    catchup=False,
)

def run_kedro_pipeline():
    project_path = "/Users/khushitulsiyan/Downloads/kedro_model/kedro-viz-finished/kedro-viz-finished/kedro-viz-finished/kedro-viz-finished"
    start_time = time.time()
    run_name = f"pipeline-run-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    log_file_path = os.path.join(project_path, "pipeline_execution.log")
    result = None
    error_message = None
    try:
        print("Before MLflow set_experiment")
        try:
            mlflow.set_experiment("kedro-pipeline")
            print("After MLflow set_experiment")
            print("MLflow tracking URI:", mlflow.get_tracking_uri())
        except Exception as e:
            print(f"MLflow set_experiment error: {e}")
        try:
            with mlflow.start_run(run_name=run_name) as run:
                print("Inside MLflow run")
                try:
                    mlflow.set_tags({"pipeline": "kedro-pipeline", "run_type": "parent"})
                    mlflow.log_param("pipeline_start_time", datetime.now().isoformat())
                    mlflow.log_params({
                        "pipeline_name": "kedro-pipeline",
                        "kedro_version": "0.18.1",
                        "mlflow_tracking_uri": mlflow.get_tracking_uri()
                    })
                    print("Logged MLflow params and tags")
                except Exception as e:
                    print(f"MLflow logging error: {e}")

                if not os.path.exists(os.path.join(project_path, 'pyproject.toml')):
                    error_message = f"Could not find pyproject.toml in {project_path}. Please ensure the DAG is in the correct location."
                    raise FileNotFoundError(error_message)
                python_path = sys.executable
                cmd = [
                    python_path, '-m', 'kedro', 'run',
                    '--conf-source', os.path.join(project_path, 'conf')
                ]
                try:
                    env = os.environ.copy()
                    env["MLFLOW_TRACKING_URI"] = "http://localhost:5000"
                    result = subprocess.run(
                        cmd,
                        cwd=project_path,
                        check=True,
                        timeout=120,
                        capture_output=True,
                        text=True,
                        env=env
                    )
                    print(result.stdout)
                    if result.returncode != 0:
                        error_message = f"Error: {result.stderr}"
                        mlflow.log_param("pipeline_status", "failed")
                        raise Exception("Kedro pipeline failed")
                    mlflow.log_param("pipeline_status", "completed")
                except subprocess.TimeoutExpired:
                    error_message = "Kedro pipeline timed out after 2 minutes"
                    print(error_message)
                    mlflow.log_param("pipeline_status", "timeout")
                    raise AirflowTaskTimeout("Pipeline execution exceeded 2 minutes")
                except subprocess.CalledProcessError as e:
                    error_message = f"Kedro pipeline failed with error: {e}"
                    print(error_message)
                    mlflow.log_param("pipeline_status", "failed")
                    raise
                except Exception as e:
                    error_message = f"An error occurred: {str(e)}"
                    print(error_message)
                    mlflow.log_param("pipeline_status", "error")
                    raise
        except Exception as e:
            print(f"MLflow start_run error: {e}")
    finally:
        print("In finally block, writing log file and logging artifact")
        with open(log_file_path, "w") as log_file:
            if result is not None:
                log_file.write("--- STDOUT ---\n")
                log_file.write(result.stdout)
                log_file.write("\n--- STDERR ---\n")
                log_file.write(result.stderr)
            if error_message:
                log_file.write(f"\n--- ERROR ---\n{error_message}\n")
        try:
            mlflow.log_artifact(log_file_path, artifact_path="logs")
            print("Logged artifact to MLflow")
        except Exception as e:
            print(f"Failed to log artifact: {e}")
        if os.path.exists(log_file_path):
            os.remove(log_file_path)
        execution_time = time.time() - start_time
        try:
            mlflow.log_metric("pipeline_execution_time", execution_time)
            print("Logged execution time metric to MLflow")
        except Exception as e:
            print(f"Failed to log metric: {e}")

task = PythonOperator(
    task_id='run_kedro_pipeline',
    python_callable=run_kedro_pipeline,
    execution_timeout=timedelta(minutes=2),
    dag=dag,
)

def generate_pipeline_json():
    logger = logging.getLogger("airflow.task")
    project_path = "/Users/khushitulsiyan/Downloads/kedro_model/kedro-viz-finished/kedro-viz-finished/kedro-viz-finished/kedro-viz-finished"
    subprocess.run(
        ["kedro", "viz", "build"],
        cwd=project_path,
        check=True
    )
    src = f"{project_path}/build/api/pipelines/__default__"
    dst = f"{project_path}/pipeline.json"
    logger.info(f"Checking for pipeline file: {src}")
    if os.path.exists(src):
        shutil.copyfile(src, dst)
        logger.info(f"Copied {src} to {dst}")
    else:
        logger.error(f"Expected pipeline file not found: {src}")
        raise FileNotFoundError(f"Expected pipeline file not found: {src}")

generate_json_task = PythonOperator(
    task_id='generate_pipeline_json',
    python_callable=generate_pipeline_json,
    dag=dag,
)



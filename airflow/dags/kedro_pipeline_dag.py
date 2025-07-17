from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python_operator import PythonOperator
from airflow.exceptions import AirflowTaskTimeout
import subprocess
import os
import sys
import mlflow
import time

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
    project_path = "/Users/khushitulsiyan/Downloads/kedro_model/kedro-viz-finished"
    start_time = time.time()
    run_name = f"pipeline-run-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    log_file_path = os.path.join(project_path, "pipeline_execution.log")
    result = None
    error_message = None
    try:
        mlflow.set_experiment("kedro-pipeline")
        with mlflow.start_run(run_name=run_name) as run:
            mlflow.set_tags({"pipeline": "kedro-pipeline", "run_type": "parent"})
            mlflow.log_param("pipeline_start_time", datetime.now().isoformat())
            mlflow.log_params({
                "pipeline_name": "kedro-pipeline",
                "kedro_version": "0.18.1",
                "mlflow_tracking_uri": mlflow.get_tracking_uri()
            })
            if not os.path.exists(os.path.join(project_path, 'pyproject.toml')):
                error_message = f"Could not find pyproject.toml in {project_path}. Please ensure the DAG is in the correct location."
                raise FileNotFoundError(error_message)
            python_path = sys.executable
            cmd = [
                python_path, '-m', 'kedro', 'run',
                '--conf-source', os.path.join(project_path, 'conf'),
                '--pipeline', 'pipeline'
            ]
            try:
                result = subprocess.run(
                    cmd,
                    cwd=project_path,
                    check=True,
                    timeout=120,
                    capture_output=True,
                    text=True
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
    finally:
        # Always write the log file and log as artifact
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
        except Exception as e:
            print(f"Failed to log artifact: {e}")
        if os.path.exists(log_file_path):
            os.remove(log_file_path)
        execution_time = time.time() - start_time
        mlflow.log_metric("pipeline_execution_time", execution_time)

task = PythonOperator(
    task_id='run_kedro_pipeline',
    python_callable=run_kedro_pipeline,
    execution_timeout=timedelta(minutes=2),
    dag=dag,
)

def generate_pipeline_json():
    subprocess.run(
        ["kedro", "viz", "--save-file", "pipeline.json"],
        cwd="/Users/khushitulsiyan/Downloads/kedro_model/kedro-viz-finished",
        check=True
    )

generate_json_task = PythonOperator(
    task_id='generate_pipeline_json',
    python_callable=generate_pipeline_json,
    dag=dag,
)

task >> generate_json_task

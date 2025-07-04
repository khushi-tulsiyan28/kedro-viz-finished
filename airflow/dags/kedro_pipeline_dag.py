from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python_operator import PythonOperator
from airflow.exceptions import AirflowTaskTimeout
import subprocess
import os
import sys

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
    try:
        # Go up two levels from the DAGs directory to reach the project root
        project_path = os.path.abspath(os.path.join(
            os.path.dirname(os.path.abspath(__file__)),  # dags directory
            '..'  # airflow directory
        ))
        
        # Verify the project path contains pyproject.toml
        if not os.path.exists(os.path.join(project_path, 'pyproject.toml')):
            raise FileNotFoundError(
                f"Could not find pyproject.toml in {project_path}. "
                "Please ensure the DAG is in the correct location."
            )
        
        python_path = sys.executable
        
        cmd = [
            python_path, '-m', 'kedro', 'run',
            '--conf-source', os.path.join(project_path, 'conf'),
            '--pipeline', 'pipeline'
        ]
        
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
            print(f"Error: {result.stderr}")
            raise Exception("Kedro pipeline failed")
            
    except subprocess.TimeoutExpired:
        print("Kedro pipeline timed out after 2 minutes")
        raise AirflowTaskTimeout("Pipeline execution exceeded 2 minutes")
    except subprocess.CalledProcessError as e:
        print(f"Kedro pipeline failed with error: {e}")
        raise
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        raise

task = PythonOperator(
    task_id='run_kedro_pipeline',
    python_callable=run_kedro_pipeline,
    execution_timeout=timedelta(minutes=2),
    dag=dag,
)

task

import logging
import os
import sys
import subprocess
import shutil
import uuid
import json
import requests
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python_operator import PythonOperator
from airflow.exceptions import AirflowTaskTimeout
import mlflow
import time
from pathlib import Path

logging.basicConfig(level=logging.INFO)

def send_repository_success_notification(guid, pipeline_name, repo_url, branch, project_path, repo_status, validation_info):
    """
    Send repository success notification to the backend API
    """
    try:
        api_url = os.getenv('BACKEND_API_URL', 'http://localhost:3001')
        endpoint = f"{api_url}/api/repository/success"
        
        payload = {
            'guid': guid,
            'pipeline_name': pipeline_name,
            'repo_url': repo_url,
            'branch': branch,
            'project_path': project_path,
            'repo_status': repo_status,
            'validation_info': validation_info,
            'timestamp': datetime.now().isoformat()
        }
        
        response = requests.post(endpoint, json=payload, timeout=10)
        
        if response.status_code == 200:
            logging.info(f"Successfully sent repository success notification to backend API for GUID: {guid}")
        else:
            logging.warning(f"Failed to send repository success notification. Status: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        logging.error(f"Error sending repository success notification to backend API: {e}")

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
    'kedro_pipeline_v2',
    default_args=default_args,
    description='Run Kedro pipeline with repo pulling and MLflow integration',
    schedule_interval=timedelta(days=1),
    catchup=False,
)

def setup_and_pull_repository(**context):
    """
    Setup SSH keys and pull repository from Git
    """
    dag_run = context['dag_run']
    
    logging.info(f"DAG Run Configuration: {dag_run.conf}")
    
    repo_url = dag_run.conf.get('repo_url', '')
    branch = dag_run.conf.get('branch', 'main')
    project_name = dag_run.conf.get('project_name', 'kedro_project')
    
    ssh_private_key = dag_run.conf.get('ssh_private_key', '')
    ssh_public_key = dag_run.conf.get('ssh_public_key', '')
    
    logging.info(f"SSH keys provided in configuration: Private key length: {len(ssh_private_key)}, Public key length: {len(ssh_public_key)}")
    
    if not ssh_private_key:
        logging.warning("SSH private key not found in configuration, using local project instead")
        project_path = "/Users/khushitulsiyan/Downloads/kedro_model/kedro-viz-finished/kedro-viz-finished/kedro-viz-finished/kedro-viz-finished"
        
        if not os.path.exists(project_path):
            raise Exception(f"Local project path does not exist: {project_path}")
        
        if not os.path.exists(os.path.join(project_path, 'pyproject.toml')):
            raise Exception(f"Local project does not contain pyproject.toml: {project_path}")
        
        logging.info("Performing local project validation...")
        
        is_git_repo = os.path.exists(os.path.join(project_path, '.git'))
        if is_git_repo:
            logging.info("Local project is a git repository")
        else:
            logging.info("Local project is not a git repository (this is acceptable)")
        
        logging.info("Local project validation successful!")
        
        validation_info = {
            'repo_url': 'local',
            'branch': 'local',
            'commit_hash': 'local',
            'commit_message': 'local project',
            'clone_successful': True,
            'validation_passed': True,
            'is_git_repo': is_git_repo
        }
        
        logging.info(f"Using local project: {project_path}")
        context['task_instance'].xcom_push(key='project_path', value=project_path)
        context['task_instance'].xcom_push(key='repo_status', value='local_project')
        context['task_instance'].xcom_push(key='validation_info', value=validation_info)
        
        send_repository_success_notification(
            guid=context['dag_run'].run_id,
            pipeline_name=dag_run.conf.get('pipeline_name', 'default-pipeline'),
            repo_url='local',
            branch='local',
            project_path=project_path,
            repo_status='local_project',
            validation_info=validation_info
        )
        
        return project_path
    
    try:
        ssh_dir = Path.home() / ".ssh"
        ssh_dir.mkdir(mode=0o700, exist_ok=True)
        
        private_key_path = ssh_dir / "id_rsa"
        with open(private_key_path, "w") as f:
            f.write(ssh_private_key)
        os.chmod(private_key_path, 0o600)
        
        public_key_path = ssh_dir / "id_rsa.pub"
        with open(public_key_path, "w") as f:
            f.write(ssh_public_key)
        os.chmod(public_key_path, 0o644)
        
        logging.info("SSH keys setup completed successfully")
        
        if not repo_url:
            raise Exception("Repository URL is required when SSH keys are provided")
        
        if not repo_url.startswith(('git@', 'https://', 'http://')):
            raise Exception(f"Invalid repository URL format: {repo_url}")
        
        project_dir = Path("/tmp") / (project_name or "kedro_project")
        if project_dir.exists():
            shutil.rmtree(project_dir)
        project_dir.mkdir(parents=True, exist_ok=True)
        
        logging.info("Testing SSH connection to repository...")
        
        if repo_url.startswith('https://'):
            if 'bitbucket.org' in repo_url:
                host = 'bitbucket.org'
            elif 'github.com' in repo_url:
                host = 'github.com'
            else:
                host = 'git.example.com'  
        elif repo_url.startswith('git@'):
            host = repo_url.split('@')[1].split(':')[0]
        else:
            host = 'bitbucket.org'  
        
        test_cmd = ["ssh", "-T", f"git@{host}"]
        logging.info(f"SSH test command: {' '.join(test_cmd)}")
        test_result = subprocess.run(test_cmd, capture_output=True, text=True, timeout=30)
        
        logging.info(f"SSH test stdout: {test_result.stdout}")
        logging.info(f"SSH test stderr: {test_result.stderr}")
        logging.info(f"SSH test return code: {test_result.returncode}")
      
        if test_result.returncode not in [0, 1]:  
            logging.error(f"SSH connection test failed: {test_result.stderr}")
            raise Exception(f"SSH connection to {host} failed. Please check your SSH keys.")
        
        logging.info(f"SSH connection test successful (return code: {test_result.returncode})")

        ssh_repo_url = repo_url.replace("https://kedro-ssh-admin@bitbucket.org/", "git@bitbucket.org:")
        logging.info(f"Cloning repository: {ssh_repo_url} (branch: {branch})")
        clone_cmd = ["git", "clone", "-b", branch, ssh_repo_url, str(project_dir)]
        result = subprocess.run(clone_cmd, capture_output=True, text=True, check=True, timeout=900)
        
        project_path = str(project_dir)
        
        if not os.path.exists(project_path):
            raise Exception(f"Repository was not cloned to expected path: {project_path}")
        
        if not os.path.exists(os.path.join(project_path, '.git')):
            raise Exception(f"Cloned directory does not contain .git folder: {project_path}")
        
        if not os.path.exists(os.path.join(project_path, 'pyproject.toml')):
            raise Exception(f"Cloned repository does not contain pyproject.toml: {project_path}")
        
        branch_cmd = ["git", "rev-parse", "--abbrev-ref", "HEAD"]
        branch_result = subprocess.run(branch_cmd, cwd=project_path, capture_output=True, text=True, check=True)
        actual_branch = branch_result.stdout.strip()
        
        if actual_branch != branch:
            logging.warning(f"Expected branch '{branch}' but got '{actual_branch}'")
        
        commit_cmd = ["git", "rev-parse", "HEAD"]
        commit_result = subprocess.run(commit_cmd, cwd=project_path, capture_output=True, text=True, check=True)
        commit_hash = commit_result.stdout.strip()
        
        log_cmd = ["git", "log", "-1", "--pretty=format:%s"]
        log_result = subprocess.run(log_cmd, cwd=project_path, capture_output=True, text=True, check=True)
        commit_message = log_result.stdout.strip()
        
        logging.info(f"Repository cloned successfully to {project_path}")
        logging.info(f"Branch: {actual_branch}")
        logging.info(f"Commit: {commit_hash[:8]} - {commit_message}")
        
        logging.info("Performing repository validation...")
        
        if not os.path.exists(project_path):
            raise Exception(f"Project path validation failed: {project_path}")
        
        if not os.path.exists(os.path.join(project_path, '.git')):
            raise Exception(f"Git repository validation failed: {project_path}")
        
        if not os.path.exists(os.path.join(project_path, 'pyproject.toml')):
            raise Exception(f"Kedro project validation failed - no pyproject.toml found: {project_path}")
        
        if actual_branch != branch:
            logging.warning(f"Branch validation: Expected '{branch}' but got '{actual_branch}'")
        
        logging.info("Repository validation successful!")
        
        validation_info = {
            'repo_url': repo_url,
            'branch': actual_branch,
            'commit_hash': commit_hash,
            'commit_message': commit_message,
            'clone_successful': True,
            'validation_passed': True
        }
        
        context['task_instance'].xcom_push(key='project_path', value=project_path)
        context['task_instance'].xcom_push(key='repo_status', value='cloned_successfully')
        context['task_instance'].xcom_push(key='validation_info', value=validation_info)
        
        send_repository_success_notification(
            guid=context['dag_run'].run_id,
            pipeline_name=dag_run.conf.get('pipeline_name', 'default-pipeline'),
            repo_url=repo_url,
            branch=branch,
            project_path=project_path,
            repo_status='cloned_successfully',
            validation_info=validation_info
        )
        
        return project_path
        
    except Exception as e:
        logging.error(f"Error in setup_and_pull_repository: {e}")
        raise

def create_mlflow_experiment(experiment_name, pipeline_name, guid):
    try:
        mlflow_tracking_uri = "http://127.0.0.1:5000"
        mlflow.set_tracking_uri(mlflow_tracking_uri)
        
        full_experiment_name = f"{experiment_name}-{pipeline_name}"
        
        experiment = mlflow.get_experiment_by_name(full_experiment_name)
        if experiment is None:
            experiment_id = mlflow.create_experiment(full_experiment_name)
            logging.info(f"Created new MLflow experiment: {full_experiment_name}")
        else:
            experiment_id = experiment.experiment_id
            logging.info(f"Using existing MLflow experiment: {full_experiment_name}")
        
        mlflow.set_experiment(full_experiment_name)
        return experiment_id
        
    except Exception as e:
        logging.error(f"Failed to create MLflow experiment: {e}")
        raise

def run_kedro_pipeline(**context):
    dag_run = context['dag_run']
    guid = dag_run.run_id 
    
    pipeline_name = context['dag_run'].conf.get('pipeline_name', 'default-pipeline')
    experiment_name = context['dag_run'].conf.get('experiment_name', 'kedro-pipeline')
    
    project_path = context['task_instance'].xcom_pull(task_ids='setup_and_pull_repo', key='project_path')
    
    start_time = time.time()
    log_file_path = None
    
    try:
        logging.info(f"Starting pipeline execution with GUID: {guid}")
        logging.info(f"Pipeline name: {pipeline_name}")
        logging.info(f"Project path: {project_path}")
        
        logging.info("Setting up MLflow experiment...")
        experiment_id = create_mlflow_experiment(experiment_name, pipeline_name, guid)
        
        run_name = f"{pipeline_name}-{guid}"
        mlflow.set_experiment(f"{experiment_name}-{pipeline_name}")
        
        with mlflow.start_run(run_name=run_name) as run:
            logging.info(f"Started MLflow run: {run.info.run_id}")
            
            mlflow.set_tags({
                "pipeline": pipeline_name,
                "guid": guid,
                "run_type": "airflow_dag",
                "repository": "local" if "tmp" not in project_path else "remote"
            })
            
            mlflow.log_params({
                "pipeline_name": pipeline_name,
                "guid": guid,
                "dag_run_id": guid,
                "pipeline_start_time": datetime.now().isoformat(),
                "kedro_version": "0.18.1",
                "mlflow_tracking_uri": mlflow.get_tracking_uri(),
                "experiment_id": experiment_id,
                "project_path": project_path
            })
            
            if not os.path.exists(os.path.join(project_path, 'pyproject.toml')):
                raise FileNotFoundError(f"Could not find pyproject.toml in {project_path}")
            
            logging.info("Running Kedro pipeline...")
            python_path = sys.executable
            cmd = [
                python_path, '-m', 'kedro', 'run',
                '--conf-source', os.path.join(project_path, 'conf')
            ]
            
            env = os.environ.copy()
            env["MLFLOW_TRACKING_URI"] = "http://127.0.0.1:5000"
            env["MLFLOW_EXPERIMENT_NAME"] = f"{experiment_name}-{pipeline_name}"
            env["MLFLOW_RUN_ID"] = run.info.run_id
            
            result = subprocess.run(
                    cmd,
                    cwd=project_path,
                    check=True,
                    timeout=900, 
                    capture_output=True,
                    text=True,
                    env=env
            )
            
            logging.info("Kedro pipeline completed successfully")
            mlflow.log_param("pipeline_status", "completed")
            
            if result.stdout:
                mlflow.log_text(result.stdout, "pipeline_stdout.txt")
            if result.stderr:
                mlflow.log_text(result.stderr, "pipeline_stderr.txt")
            
            execution_time = time.time() - start_time
            mlflow.log_metric("pipeline_execution_time", execution_time)
            mlflow.log_metric("pipeline_success", 1)
            
            log_file_path = os.path.join(project_path, f"pipeline_execution_{guid}.log")
        with open(log_file_path, "w") as log_file:
            log_file.write(f"Pipeline: {pipeline_name}\n")
            log_file.write(f"GUID: {guid}\n")
            log_file.write(f"Start Time: {datetime.now().isoformat()}\n")
            log_file.write(f"Execution Time: {execution_time:.2f} seconds\n")
            log_file.write("--- STDOUT ---\n")
            log_file.write(result.stdout)
            log_file.write("\n--- STDERR ---\n")
            log_file.write(result.stderr)
            
            mlflow.log_artifact(log_file_path, artifact_path="logs")
            
        pipeline_json_path = os.path.join(project_path, "pipeline.json")
        if os.path.exists(pipeline_json_path):
            mlflow.log_artifact(pipeline_json_path, artifact_path="pipeline")
            
        logging.info(f"Pipeline execution completed successfully. GUID: {guid}")
            
    except subprocess.TimeoutExpired:
        error_msg = "Kedro pipeline timed out after 15 minutes"
        logging.error(error_msg)
        mlflow.log_param("pipeline_status", "timeout")
        mlflow.log_param("error", error_msg)
        raise AirflowTaskTimeout(error_msg)
        
    except subprocess.CalledProcessError as e:
        error_msg = f"Kedro pipeline failed with error: {e.stderr}"
        logging.error(error_msg)
        mlflow.log_param("pipeline_status", "failed")
        mlflow.log_param("error", error_msg)
        raise
        
    except Exception as e:
        error_msg = f"An error occurred: {str(e)}"
        logging.error(error_msg)
        mlflow.log_param("pipeline_status", "error")
        mlflow.log_param("error", error_msg)
        raise
        
    finally:
        if log_file_path and os.path.exists(log_file_path):
            os.remove(log_file_path)

def generate_pipeline_json(**context):
    logger = logging.getLogger("airflow.task")
    
    project_path = context['task_instance'].xcom_pull(task_ids='setup_and_pull_repo', key='project_path')
    
    try:
        subprocess.run(
            ["kedro", "viz", "build"],
            cwd=project_path,
            check=True
        )
        
        src = f"{project_path}/build/api/pipelines/__default__"
        dst = f"{project_path}/pipeline.json"
        
        if os.path.exists(src):
            shutil.copyfile(src, dst)
            logger.info(f"Generated pipeline.json at {dst}")
        else:
            logger.error(f"Expected pipeline file not found: {src}")
            raise FileNotFoundError(f"Expected pipeline file not found: {src}")
            
    except Exception as e:
        logger.error(f"Failed to generate pipeline JSON: {e}")
        raise

setup_and_pull_repo_task = PythonOperator(
    task_id='setup_and_pull_repo',
    python_callable=setup_and_pull_repository,
    provide_context=True,
    execution_timeout=timedelta(minutes=20),
    dag=dag,
)

run_pipeline_task = PythonOperator(
    task_id='run_kedro_pipeline',
    python_callable=run_kedro_pipeline,
    provide_context=True,
    execution_timeout=timedelta(minutes=10),
    dag=dag,
    )

generate_json_task = PythonOperator(
    task_id='generate_pipeline_json',
    python_callable=generate_pipeline_json,
    provide_context=True,
    dag=dag,
)

setup_and_pull_repo_task >> run_pipeline_task >> generate_json_task



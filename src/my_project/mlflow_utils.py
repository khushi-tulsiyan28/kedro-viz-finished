import os
import mlflow
from pathlib import Path
from typing import Optional, Dict, Any
from contextlib import contextmanager

def setup_mlflow():
    mlflow_tracking_uri = os.getenv("MLFLOW_TRACKING_URI", "file://" + str(Path.cwd() / "mlruns"))
    mlflow.set_tracking_uri(mlflow_tracking_uri)
    experiment_name = os.getenv("MLFLOW_EXPERIMENT_NAME", "kedro-pipeline")
    mlflow.set_experiment(experiment_name)

@contextmanager
def mlflow_run(run_name: Optional[str] = None, tags: Optional[Dict[str, Any]] = None):
    setup_mlflow()
    with mlflow.start_run(run_name=run_name, tags=tags) as run:
        try:
            yield run
        except Exception as e:
            mlflow.log_param("status", "failed")
            mlflow.log_param("error", str(e))
            raise
        else:
            mlflow.log_param("status", "success")

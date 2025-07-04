from kedro.pipeline import Pipeline, node
from .nodes import node1, node2, node3, node4
from .mlflow_utils import mlflow_run
import mlflow
import time
from datetime import datetime

def create_pipeline(**kwargs):
    start_time = time.time()
    
    with mlflow_run(run_name=f"pipeline-run-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
                   tags={"pipeline": "kedro-pipeline", "run_type": "parent"}):
        
        mlflow.log_param("pipeline_start_time", datetime.now().isoformat())
        mlflow.log_params({
            "pipeline_name": "kedro-pipeline",
            "kedro_version": "0.18.1",
            "mlflow_tracking_uri": mlflow.get_tracking_uri()
        })
        
        pipeline = Pipeline([
            node(node1, None, "msg1", name="node1"),
            node(node2, "msg1", "msg2", name="node2"),
            node(node3, "msg2", "msg3", name="node3"),
            node(node4, "msg3", "final_msg", name="node4"),
        ])
        
        mlflow.log_param("nodes", ", ".join([n.name for n in pipeline.nodes]))
        
        execution_time = time.time() - start_time
        mlflow.log_metric("pipeline_execution_time", execution_time)
        mlflow.log_param("pipeline_status", "completed")
        
        return pipeline

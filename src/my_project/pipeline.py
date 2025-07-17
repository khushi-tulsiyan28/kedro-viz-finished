from kedro.pipeline import Pipeline, node
from .nodes import node1, node2, node3, node4
from .mlflow_utils import mlflow_run
import mlflow
import time
from datetime import datetime

def create_pipeline(**kwargs):
    start_time = time.time()
    
        
    pipeline = Pipeline([
            node(node1, None, "msg1", name="node1"),
            node(node2, "msg1", "msg2", name="node2"),
            node(node3, "msg2", "msg3", name="node3"),
            node(node4, "msg3", "final_msg", name="node4"),
        ])
        

    return pipeline

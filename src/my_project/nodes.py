import mlflow
import time
from datetime import datetime
from pathlib import Path
from .mlflow_utils import mlflow_run

def log_node_metrics(func):
    def wrapper(*args, **kwargs):
        node_name = func.__name__
        start_time = time.time()
        try:
            if args:
                mlflow.log_params({f"{node_name}_input_arg_{i}": str(arg) for i, arg in enumerate(args)})
            if kwargs:
                mlflow.log_params({f"{node_name}_input_kwarg_{k}": str(v) for k, v in kwargs.items()})
            node_type = None
            if 'node_type' in kwargs:
                node_type = kwargs['node_type']
            elif node_name.startswith('node'):
                if node_name == 'node1':
                    node_type = 'generator'
                elif node_name == 'node4':
                    node_type = 'final_processor'
                else:
                    node_type = 'processor'
            if node_type:
                mlflow.log_param(f"{node_name}_type", node_type)
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            mlflow.log_metric(f"{node_name}_execution_time", execution_time)
            mlflow.log_metric(f"{node_name}_output_length", len(str(result)))
            result_str = str(result)
            if len(result_str) < 1000:
                mlflow.log_param(f"{node_name}_output", result_str)
            return result
        except Exception as e:
            mlflow.log_param("error", str(e))
            raise
    wrapper.__name__ = func.__name__
    return wrapper

@log_node_metrics
def node1():
    print("Hello from node 1")
    return "Hello"

@log_node_metrics
def node2(msg):
    result = f"{msg}, node 2"
    print(result)
    return result

@log_node_metrics
def node3(msg):
    result = f"{msg}, node 3"
    print(result)
    return result

@log_node_metrics
def node4(msg):
    result = f"{msg}, node 4. Final message!"
    
    example_artifact = Path("example_metrics.txt")
    with open(example_artifact, "w") as f:
        f.write(f"Final result: {result}\n")
        f.write(f"Timestamp: {datetime.now().isoformat()}\n")
    
    mlflow.log_artifact(example_artifact, artifact_path="metrics")
    example_artifact.unlink()
    
    readme = Path("README.md")
    if readme.exists():
        mlflow.log_artifact(readme, artifact_path="docs")
    
    print(result)
    return result

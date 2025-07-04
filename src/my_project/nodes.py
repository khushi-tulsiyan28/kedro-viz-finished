import mlflow
import time
from datetime import datetime
from pathlib import Path
from .mlflow_utils import mlflow_run

def log_node_metrics(func):
    def wrapper(*args, **kwargs):
        node_name = func.__name__
        start_time = time.time()
        
        with mlflow_run(run_name=f"{node_name}-{datetime.now().strftime('%Y%m%d-%H%M%S')}", 
                      tags={"node": node_name, "pipeline": "kedro-pipeline"}):
            try:
                if args:
                    mlflow.log_params({f"input_arg_{i}": str(arg) for i, arg in enumerate(args)})
                if kwargs:
                    mlflow.log_params({f"input_kwarg_{k}": str(v) for k, v in kwargs.items()})
                
                result = func(*args, **kwargs)
                
                execution_time = time.time() - start_time
                mlflow.log_metric(f"{node_name}_execution_time", execution_time)
                mlflow.log_metric(f"{node_name}_output_length", len(str(result)))
                
                result_str = str(result)
                if len(result_str) < 1000:
                    mlflow.log_param("output", result_str)
                
                return result
                
            except Exception as e:
                mlflow.log_param("error", str(e))
                raise
    
    wrapper.__name__ = func.__name__
    return wrapper

@log_node_metrics
def node1():
    mlflow.log_param("node_type", "generator")
    print("Hello from node 1")
    return "Hello"

@log_node_metrics
def node2(msg):
    mlflow.log_param("node_type", "processor")
    result = f"{msg}, node 2"
    print(result)
    return result

@log_node_metrics
def node3(msg):
    mlflow.log_param("node_type", "processor")
    result = f"{msg}, node 3"
    print(result)
    return result

@log_node_metrics
def node4(msg):
    mlflow.log_param("node_type", "final_processor")
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

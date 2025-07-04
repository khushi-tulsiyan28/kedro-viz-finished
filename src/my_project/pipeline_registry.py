from kedro.pipeline import Pipeline
from .pipeline import create_pipeline

def register_pipelines() -> dict:
    return { "__default__": create_pipeline() }

# Kedro-Viz-Finished

A full-stack data pipeline project using [Kedro](https://kedro.readthedocs.io/), [Airflow](https://airflow.apache.org/), [MLflow](https://mlflow.org/), and a custom [React](https://reactjs.org/) frontend for pipeline visualization and control.

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Python Backend Setup](#2-python-backend-setup)
  - [3. Airflow Setup (Optional)](#3-airflow-setup-optional)
  - [4. MLflow Setup (Optional)](#4-mlflow-setup-optional)
  - [5. Frontend Setup](#5-frontend-setup)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

- Modular data pipelines with Kedro
- Pipeline orchestration with Airflow
- Experiment tracking with MLflow
- Interactive pipeline visualization and controls via React frontend

---

## Project Structure

```
.
├── airflow/                # Airflow DAGs and requirements
├── conf/                   # Kedro configuration (catalog, parameters)
├── frontend-react/         # React frontend app
├── pipeline.json/          # Pipeline and node definitions (for visualization)
├── src/my_project/         # Main Python source code (pipelines, nodes, utils)
├── requirements.txt        # Python dependencies
├── requirements-mlflow.txt # Extra dependencies for MLflow
├── pyproject.toml          # Python project metadata
└── README.md               # (You are here)
```

---

## Prerequisites

- Python 3.8+
- [Node.js](https://nodejs.org/) (v14+ recommended) and npm
- (Optional) [Airflow](https://airflow.apache.org/) for orchestration
- (Optional) [MLflow](https://mlflow.org/) for experiment tracking

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <https://github.com/khushi-tulsiyan28/kedro-viz-finished>
cd kedro-viz-finished
```

### 2. Python Backend Setup

Create and activate a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

If you want MLflow integration:

```bash
pip install -r requirements-mlflow.txt
```

### 3. Airflow Setup (Optional)

If you want to use Airflow for pipeline orchestration:

```bash
pip install -r requirements.txt
# Initialize Airflow DB & make sure your dag is present in airflow's dags_folder
export AIRFLOW_HOME=$(pwd)
airflow db init
# Create a user (follow prompts)
airflow users create --username admin --password admin --firstname Admin --lastname User --role Admin --email admin@example.com
# Start Airflow webserver and scheduler (in separate terminals)
airflow webserver
airflow scheduler
```

### 4. MLflow Setup (Optional)

To use MLflow for experiment tracking:

```bash
sourvce .venv/bin/activate
mlflow ui
```

By default, this will start the MLflow UI at http://localhost:5000.


### 5. Backend Setup

```bash
cd frontend-react
node server.js
```
The server will start on port 3000

### 6. Frontend Setup

```bash
cd frontend-react
npm install
npm start
```

The React app will start at http://localhost:3000.


---

## Usage

- **Develop pipelines:** Edit or add nodes in `src/my_project/nodes.py` and define pipelines in `src/my_project/pipeline.py`.
- **Run pipelines:**  
  ```bash
  kedro run
  ```
- **Visualize pipelines:**  
  - Start the React frontend (`npm start` in `frontend-react/`)
  - The app will visualize pipeline structure and allow control/monitoring.
- **Orchestrate with Airflow:**  
  - Ensure Airflow is running and DAGs are detected in `airflow/dags/`.
- **Track experiments with MLflow:**  
  - Ensure MLflow is running and integrated in your pipeline code.

---

## Troubleshooting

- **Port conflicts:** Make sure ports 3000 (React), 5000 (MLflow), and 8080 (Airflow) are free.
- **Virtual environment issues:** Always activate your Python virtual environment before running backend commands.
- **Missing dependencies:** Double-check you’ve installed all requirements for both Python and Node.js.

---

## License

[MIT](LICENSE) (or specify your license here)

---

**Happy hacking!**  
For questions or issues, please open an issue in this repository.
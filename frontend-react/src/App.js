  import React, { useState, useEffect } from 'react';
  import { Container, CircularProgress, Box } from '@mui/material';
  import PipelineControls from './components/PipelineControls';
  import PipelineVisualization from './components/PipelineVisualization';
  import ArtifactsPanel from './components/ArtifactsPanel';
  import ExecutionLog from './components/ExecutionLog';
  import KedroViz from '@quantumblack/kedro-viz';
  import '@quantumblack/kedro-viz/lib/styles/styles.min.css';
  import PipelineControlPanel from './components/PipelineControlPanel';

  const initialNodes = [
    { id: 'node1', name: 'Node 1', description: 'Data Loading', status: 'pending', statusLabel: 'Pending' },
    { id: 'node2', name: 'Node 2', description: 'Data Processing', status: 'pending', statusLabel: 'Pending' },
    { id: 'node3', name: 'Node 3', description: 'Feature Engineering', status: 'pending', statusLabel: 'Pending' },
    { id: 'node4', name: 'Node 4', description: 'Final Processing', status: 'pending', statusLabel: 'Pending' }
  ];

  function App() {
    const [repo, setRepo] = useState('');
    const [pipelineName, setPipelineName] = useState('');
    const [experimentId, setExperimentId] = useState('');
    const [token, setToken] = useState('');
    const [airflowRunId, setAirflowRunId] = useState('');
    const [mlflowRunId, setMlflowRunId] = useState('');
    const [artifacts, setArtifacts] = useState([]);
    const [artifactsLoading, setArtifactsLoading] = useState(false);
    const [artifactsError, setArtifactsError] = useState('');
    const [nodes, setNodes] = useState(initialNodes);
    const [isRunning, setIsRunning] = useState(false);
    const [pipelineData, setPipelineData] = useState(null);
    const [pipelineLoading, setPipelineLoading] = useState(false);

    useEffect(() => {
    if (experimentId) {
        setPipelineLoading(true);
        fetch('/api/pipeline-data')
          .then(res => res.json())
          .then(data => {
            setPipelineData(data);
            console.log(data);
          })
          .catch(() => setPipelineData(null))
          .finally(() => setPipelineLoading(false));
      }
    }, [experimentId]);

    
    useEffect(() => {
      const interval = setInterval(() => {
        fetch('/api/pipeline-log')
          .then(res => res.json())
          .then(data => {
            
          });
        fetch('/api/pipeline-status')
          .then(res => res.json())
          .then(data => setIsRunning(data.status === 'running'));
      }, 3000);
      return () => clearInterval(interval);
    }, []);

    useEffect(() => {
      async function fetchLatestMlflowLog() {
        const experiment = 'kedro-pipeline';
        try {
          const res = await fetch(`/api/mlflow/artifacts?experiment_id=${experiment}`);
          if (!res.ok) return;
          const data = await res.json();
          if (!data.run_id) return;
          const logFile = (data.artifacts || []).find(f => f.path === 'logs/pipeline_execution.log');
          if (logFile) {
            const logRes = await fetch(`/api/mlflow/artifact-content?run_id=${data.run_id}&path=${encodeURIComponent(logFile.path)}`);
            if (!logRes.ok) return;
            const logData = await logRes.json();
            try {
              
            } catch {
            }
          } else {
            
          }
        } catch {
          
        }
      }
      fetchLatestMlflowLog();
    }, [isRunning]);

  const handleRunPipeline = async () => {
    setNodes(initialNodes.map(node => ({ ...node, status: 'pending', statusLabel: 'Pending' })));
    setIsRunning(true);
    try {
      const res = await fetch('/api/run-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, pipelineName, experimentId, token })
      });
      const data = await res.json();
      if (data.run_id) {
        setAirflowRunId(data.run_id); // Set Airflow run ID for log polling
      }
    } catch (err) {
      setIsRunning(false);
      return;
    }
  };

    const handleFetchArtifacts = async () => {
      setArtifacts([]);
      setArtifactsError('');
      setArtifactsLoading(true);
      try {
        const res = await fetch(`/api/mlflow/artifacts?experiment_id=${experimentId}`);
        if (!res.ok) {
          const err = await res.json();
          setArtifactsError(err.error || 'Failed to fetch artifacts.');
          setArtifactsLoading(false);
          return;
        }
        const data = await res.json();
        setMlflowRunId(data.run_id); // Set MLflow run ID for artifact queries
        setArtifacts(data.artifacts);
      } catch (err) {
        setArtifactsError(err.message);
      }
      setArtifactsLoading(false);
    };

    const handleFetchArtifactsByRunId = async () => {
      setArtifacts([]);
      setArtifactsError('');
      setArtifactsLoading(true);
      try {
        const res = await fetch(`/api/mlflow/artifacts/by-run-id?run_id=${mlflowRunId}`);
        if (!res.ok) {
          const err = await res.json();
          setArtifactsError(err.error || 'Failed to fetch artifacts.');
          setArtifactsLoading(false);
          return;
        }
        const data = await res.json();
        setArtifacts(data.artifacts);
      } catch (err) {
        setArtifactsError(err.message);
      }
      setArtifactsLoading(false);
    };

    return (
      <div className="App">
        <PipelineControlPanel
          repo={repo}
          setRepo={setRepo}
          pipelineName={pipelineName}
          setPipelineName={setPipelineName}
          experimentId={experimentId}
          setExperimentId={setExperimentId}
          token={token}
          setToken={setToken}
          onRunPipeline={handleRunPipeline}
        />
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <header>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#333', marginBottom: 8 }}>
              Kedro Pipeline Visualizer
            </h1>
            <p style={{ color: '#666', marginBottom: 24 }}>
              Real-time pipeline execution monitoring
            </p>
          </header>
          <Box mb={2}>
            <label htmlFor="experiment-id-input">Experiment ID: </label>
            <input
              id="experiment-id-input"
              type="text"
              value={experimentId}
              onChange={e => setExperimentId(e.target.value)}
              placeholder="Enter Experiment ID"
              style={{ marginRight: 8 }}
            />
            <button onClick={handleFetchArtifacts} disabled={!experimentId || artifactsLoading}>
              Fetch Artifacts by Experiment ID
            </button>
          </Box>
          <Box mb={4}>
            <label htmlFor="run-id-input">Run ID: </label>
            <input
              id="run-id-input"
              type="text"
              value={mlflowRunId}
              onChange={e => setMlflowRunId(e.target.value)}
              placeholder="Enter Run ID"
              style={{ marginRight: 8 }}
            />
            <button onClick={handleFetchArtifactsByRunId} disabled={!mlflowRunId || artifactsLoading}>
              Fetch Artifacts by Run ID
            </button>
          </Box>
          <Box mb={4}>
            {pipelineLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                <CircularProgress />
              </Box>
            ) : pipelineData ? (
              <KedroViz
                  data={pipelineData}
                  options={{
                    display: {
                      expandPipelinesBtn: true,
                      exportBtn: true,
                      globalNavigation: false,
                      labelBtn: true,
                      layerBtn: true,
                      metadataPanel: true,
                      miniMap: false,
                      sidebar: false,
                      zoomToolbar: true,
                    },
                    expandAllPipelines: false,
                    nodeType: {
                      disabled: { parameters: true }
                    },
                    tag: {
                      enabled: { companies: true }
                    },
                    behaviour: {
                      reFocus: true,
                    },
                    theme: "dark"
                  }}
              />


          ) : (
              <Box color="error.main">Failed to load pipeline data.</Box>
            )}
          </Box>
          <PipelineControls
            experimentId={experimentId}
            setExperimentId={setExperimentId}
            onFetchArtifacts={handleFetchArtifacts}
            onRunPipeline={handleRunPipeline}
            isRunning={isRunning}
          />
          <PipelineVisualization nodes={nodes} />
          <ArtifactsPanel
            runId={mlflowRunId}
            experimentId={experimentId}
            artifacts={artifacts}
            loading={artifactsLoading}
            error={artifactsError}
          />
          <ExecutionLog
            dagId="kedro_pipeline"
            runId={airflowRunId}
            taskId="run_kedro_pipeline"
            attempt={1}
          />
        </Container>
      </div>
    );
  }

  export default App;

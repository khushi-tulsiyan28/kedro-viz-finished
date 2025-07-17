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
  const [experimentId, setExperimentId] = useState('');
  const [runId, setRunId] = useState('');
  const [artifacts, setArtifacts] = useState([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactsError, setArtifactsError] = useState('');
  const [nodes, setNodes] = useState(initialNodes);
  const [logLines, setLogLines] = useState(['Ready to run the pipeline...']);
  const [isRunning, setIsRunning] = useState(false);
  const [pipelineData, setPipelineData] = useState(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);

  useEffect(() => {
    // Fetch pipeline JSON for KedroViz

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

  // Poll for log and status
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/pipeline-log')
        .then(res => res.json())
        .then(data => setLogLines(data.log.split('\n')));
      fetch('/api/pipeline-status')
        .then(res => res.json())
        .then(data => setIsRunning(data.status === 'running'));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleRunPipeline = async () => {
    // Reset UI
    setNodes(initialNodes.map(node => ({ ...node, status: 'pending', statusLabel: 'Pending' })));
    setLogLines(['Starting pipeline execution...']);
    setIsRunning(true);
    // Call backend to trigger Airflow DAG
    try {
      const res = await fetch('/api/run-pipeline', { method: 'POST' });
      const data = await res.json();
      setLogLines(lines => [...lines, data.message || 'Airflow DAG triggered']);
      // Polling will pick up log/status changes
    } catch (err) {
      setLogLines(lines => [...lines, 'Failed to trigger Airflow DAG']);
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
      setRunId(data.run_id);
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
      const res = await fetch(`/api/mlflow/artifacts/by-run-id?run_id=${runId}`);
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
      <PipelineControlPanel />
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
            value={runId}
            onChange={e => setRunId(e.target.value)}
            placeholder="Enter Run ID"
            style={{ marginRight: 8 }}
          />
          <button onClick={handleFetchArtifactsByRunId} disabled={!runId || artifactsLoading}>
            Fetch Artifacts by Run ID
          </button>
        </Box>
        <Box mb={4}>
          {pipelineLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
              <CircularProgress />
            </Box>
          ) : pipelineData ? (
            // <KedroViz data={pipelineData} />
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


            // <div> {JSON.stringify(pipelineData)}</div>
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
          runId={runId}
          experimentId={experimentId}
          artifacts={artifacts}
          loading={artifactsLoading}
          error={artifactsError}
        />
        <ExecutionLog logLines={logLines} />
      </Container>
    </div>
  );
}

export default App;

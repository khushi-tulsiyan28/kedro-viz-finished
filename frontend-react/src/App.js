  import React, { useState, useEffect } from 'react';
  import { Container, CircularProgress, Box, Paper, Typography, CssBaseline, AppBar, Toolbar } from '@mui/material';
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
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', fontFamily: 'Roboto, Arial, sans-serif' }}>
        <CssBaseline />
        <AppBar position="sticky" color="primary" elevation={2}>
          <Toolbar>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: 1 }}>
              Kedro Pipeline Visualizer
            </Typography>
          </Toolbar>
        </AppBar>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 3 }}>
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
          </Paper>
          <Paper elevation={1} sx={{ p: 3, mb: 4, borderRadius: 3 }}>
            <Box mb={3}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Pipeline Visualization
              </Typography>
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
            <ArtifactsPanel
              runId={mlflowRunId}
              experimentId={experimentId}
              artifacts={artifacts}
              loading={artifactsLoading}
              error={artifactsError}
            />
            <Box mt={4}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Execution Log
              </Typography>
              <ExecutionLog
                dagId="kedro_pipeline"
                runId={airflowRunId}
                taskId="run_kedro_pipeline"
                attempt={1}
              />
            </Box>
          </Paper>
        </Container>
        <Box component="footer" sx={{ py: 2, textAlign: 'center', bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            Kedro Pipeline Visualizer &copy; {new Date().getFullYear()} &mdash; v1.0.0
          </Typography>
        </Box>
      </Box>
    );
  }

  export default App;

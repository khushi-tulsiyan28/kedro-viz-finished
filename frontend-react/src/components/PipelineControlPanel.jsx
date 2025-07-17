import React, { useState } from 'react';
import { Button, TextField, Box, Typography, Alert } from '@mui/material';

const PipelineControlPanel = () => {
  const [repo, setRepo] = useState('');
  const [pipelineName, setPipelineName] = useState('');
  const [experimentId, setExperimentId] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePullRepo = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/pull-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, pipelineName, experimentId, token })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setError(data.error || 'Failed to pull repo');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  const handleRunPipeline = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/run-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, pipelineName, experimentId })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setError(data.error || 'Failed to run pipeline');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  return (
    <Box sx={{ p: 2, mb: 2, border: '1px solid #ccc', borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom>Pipeline Control Panel</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label="Git Repo URL" value={repo} onChange={e => setRepo(e.target.value)} fullWidth />
        <TextField label="Pipeline Name" value={pipelineName} onChange={e => setPipelineName(e.target.value)} fullWidth />
        <TextField label="Experiment ID" value={experimentId} onChange={e => setExperimentId(e.target.value)} fullWidth />
        <TextField label="Token (SSH/PAT)" value={token} onChange={e => setToken(e.target.value)} fullWidth type="password" />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" color="primary" onClick={handlePullRepo} disabled={loading}>Pull/Update Repo</Button>
          <Button variant="contained" color="secondary" onClick={handleRunPipeline} disabled={loading}>Run Pipeline</Button>
        </Box>
        {message && <Alert severity="success">{message}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
      </Box>
    </Box>
  );
};

export default PipelineControlPanel; 
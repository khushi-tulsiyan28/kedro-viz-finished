import React, { useState } from 'react';
import { Button, TextField, Box, Typography, Alert, Grid, Tooltip, CircularProgress, InputAdornment } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const PipelineControlPanel = ({
  repo,
  setRepo,
  pipelineName,
  setPipelineName,
  experimentId,
  setExperimentId,
  token,
  setToken,
  onRunPipeline
}) => {
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

  // Validation logic
  const errors = {
    repo: !repo ? 'Repository URL is required' : '',
    pipelineName: !pipelineName ? 'Pipeline name is required' : '',
    experimentId: !experimentId ? 'Experiment ID is required' : '',
    token: !token ? 'Token is required' : ''
  };
  const isValid = Object.values(errors).every(e => !e);

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
    setTouched({ repo: true, pipelineName: true, experimentId: true, token: true });
    if (!isValid) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await onRunPipeline();
    } catch (err) {
      setError('Failed to run pipeline');
    }
    setLoading(false);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Pipeline Control Panel</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Tooltip title="The GitHub repository URL for your Kedro project." placement="right" arrow>
            <TextField
              label="Git Repo URL"
              value={repo}
              onChange={e => setRepo(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, repo: true }))}
              fullWidth
              required
              error={touched.repo && !!errors.repo}
              helperText={touched.repo && errors.repo}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <InfoOutlinedIcon fontSize="small" color="action" />
                  </InputAdornment>
                )
              }}
            />
          </Tooltip>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Tooltip title="The name of the pipeline to run (e.g., 'kedro-pipeline')." placement="right" arrow>
            <TextField
              label="Pipeline Name"
              value={pipelineName}
              onChange={e => setPipelineName(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, pipelineName: true }))}
              fullWidth
              required
              error={touched.pipelineName && !!errors.pipelineName}
              helperText={touched.pipelineName && errors.pipelineName}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <InfoOutlinedIcon fontSize="small" color="action" />
                  </InputAdornment>
                )
              }}
            />
          </Tooltip>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Tooltip title="The MLflow experiment ID to use for tracking runs." placement="right" arrow>
            <TextField
              label="Experiment ID"
              value={experimentId}
              onChange={e => setExperimentId(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, experimentId: true }))}
              fullWidth
              required
              error={touched.experimentId && !!errors.experimentId}
              helperText={touched.experimentId && errors.experimentId}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <InfoOutlinedIcon fontSize="small" color="action" />
                  </InputAdornment>
                )
              }}
            />
          </Tooltip>
        </Grid>
        <Grid item xs={12}>
          <Tooltip title="Your GitHub Personal Access Token (PAT) or SSH token for repo access." placement="right" arrow>
            <TextField
              label="Token (SSH/PAT)"
              value={token}
              onChange={e => setToken(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, token: true }))}
              fullWidth
              required
              type="password"
              error={touched.token && !!errors.token}
              helperText={touched.token && errors.token}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <InfoOutlinedIcon fontSize="small" color="action" />
                  </InputAdornment>
                )
              }}
            />
          </Tooltip>
        </Grid>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Button variant="contained" color="primary" onClick={handlePullRepo} disabled={loading}>
              Pull/Update Repo
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={handleRunPipeline}
              disabled={loading || !isValid}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
            >
              Run Pipeline
            </Button>
          </Box>
        </Grid>
        {message && (
          <Grid item xs={12}>
            <Alert severity="success">{message}</Alert>
          </Grid>
        )}
        {error && (
          <Grid item xs={12}>
            <Alert severity="error">{error}</Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default PipelineControlPanel; 
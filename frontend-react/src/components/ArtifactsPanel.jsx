import React from 'react';
import { List, ListItem, Link, Typography, CircularProgress, Alert, Box } from '@mui/material';

export default function ArtifactsPanel({ runId, experimentId, artifacts, loading, error }) {
  if (!runId) return null;
  return (
    <Box mt={4}>
      <Typography variant="subtitle1" fontWeight="bold" mb={1}>
        Artifacts for run <span style={{ color: '#1976d2' }}>{runId}</span>
      </Typography>
      <Box mb={2}>
        <Link
          href={`http://127.0.0.1:5000/#/experiments/${experimentId}/runs/${runId}/artifacts`}
          target="_blank"
          rel="noopener noreferrer"
          color="success.main"
          underline="hover"
        >
          Open in MLflow UI
        </Link>
      </Box>
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && (
        <List dense>
          {artifacts.map(file => (
            <ListItem key={file.path}>
              {file.is_dir ? (
                <Link
                  href={`http://localhost:5000/#/experiments/${experimentId}/runs/${runId}/artifacts/${encodeURIComponent(file.path)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  color="primary"
                >
                  📁 {file.path}
                </Link>
              ) : (
                <Link
                  href={`http://localhost:5000/api/2.0/mlflow/artifacts/download?run_id=${runId}&path=${encodeURIComponent(file.path)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                >
                  {file.path}
                </Link>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
} 
import React, { useState } from 'react';
import { List, ListItem, Link, Typography, CircularProgress, Alert, Box, Button, Paper } from '@mui/material';

export default function ArtifactsPanel({ runId, experimentId, artifacts, loading, error }) {
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [artifactContent, setArtifactContent] = useState('');
  const [artifactContentLoading, setArtifactContentLoading] = useState(false);
  const [artifactContentError, setArtifactContentError] = useState('');

  const handleShowContent = async (file) => {
    setSelectedArtifact(file.path);
    setArtifactContent('');
    setArtifactContentError('');
    setArtifactContentLoading(true);
    try {
      const res = await fetch(`/api/mlflow/artifact-content?run_id=${runId}&path=${encodeURIComponent(file.path)}`);
      if (!res.ok) {
        const err = await res.json();
        setArtifactContentError(err.error || 'Failed to fetch artifact content.');
        setArtifactContentLoading(false);
        return;
      }
      const data = await res.json();
      setArtifactContent(data.base64);
    } catch (err) {
      setArtifactContentError(err.message);
    }
    setArtifactContentLoading(false);
  };

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
                <span>📁 {file.path}</span>
              ) : (
                <>
                  <span>{file.path}</span>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ ml: 2 }}
                    onClick={() => handleShowContent(file)}
                    disabled={artifactContentLoading && selectedArtifact === file.path}
                  >
                    Show Content
                  </Button>
                </>
              )}
            </ListItem>
          ))}
        </List>
      )}
      {selectedArtifact && (
        <Box mt={3}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" mb={1}>
              Content of: <span style={{ color: '#1976d2' }}>{selectedArtifact}</span>
            </Typography>
            {artifactContentLoading && <CircularProgress size={20} />}
            {artifactContentError && <Alert severity="error">{artifactContentError}</Alert>}
            {!artifactContentLoading && !artifactContentError && artifactContent && (
              <Box sx={{ maxHeight: 400, overflow: 'auto', wordBreak: 'break-all', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {/* Try to decode as text, otherwise show base64 with a note */}
                {(() => {
                  try {
                    const text = atob(artifactContent);
                    // If text is mostly printable, show as text
                    if (/^[\x09\x0A\x0D\x20-\x7E\xA0-\xFF]*$/.test(text)) {
                      return <pre>{text}</pre>;
                    } else {
                      return <>
                        <Alert severity="info">Binary file (showing base64):</Alert>
                        <pre>{artifactContent}</pre>
                      </>;
                    }
                  } catch {
                    return <pre>{artifactContent}</pre>;
                  }
                })()}
              </Box>
            )}
          </Paper>
        </Box>
      )}
    </Box>
  );
} 
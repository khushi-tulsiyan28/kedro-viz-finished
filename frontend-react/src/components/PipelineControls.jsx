import React from 'react';
import { TextField, Button, Stack } from '@mui/material';

export default function PipelineControls({
  experimentId,
  setExperimentId,
  onFetchArtifacts,
  onRunPipeline,
  isRunning
}) {
  return (
    <Stack direction="row" spacing={2} mb={2}>
      <TextField
        label="MLflow Experiment ID"
        variant="outlined"
        size="small"
        value={experimentId}
        onChange={e => setExperimentId(e.target.value)}
        sx={{ width: 300 }}
      />
      <Button
        variant="contained"
        color="success"
        onClick={onFetchArtifacts}
        disabled={isRunning}
      >
        Fetch Artifacts
      </Button>
      
    </Stack>
  );
} 
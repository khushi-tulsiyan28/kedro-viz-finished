import React from 'react';
import { Grid, Card, CardContent, Typography, Chip } from '@mui/material';

const statusColor = {
  pending: 'default',
  running: 'info',
  completed: 'success',
  error: 'error'
};

export default function PipelineVisualization({ nodes }) {
  return (
    <Grid container spacing={3} sx={{ py: 3 }}>
      {nodes.map(node => (
        <Grid item xs={12} sm={6} md={3} key={node.id}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {node.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {node.description}
              </Typography>
              <Chip
                label={node.statusLabel}
                color={statusColor[node.status]}
                variant="outlined"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
} 
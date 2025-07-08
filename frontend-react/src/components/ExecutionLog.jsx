import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

export default function ExecutionLog({ logLines }) {
  return (
    <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Execution Log
      </Typography>
      <Box
        sx={{
          background: '#212121',
          color: '#00e676',
          fontFamily: 'monospace',
          fontSize: 14,
          borderRadius: 1,
          p: 2,
          height: 200,
          overflowY: 'auto'
        }}
      >
        {logLines.map((line, idx) => (
          <div key={idx}>{line}</div>
        ))}
      </Box>
    </Paper>
  );
} 
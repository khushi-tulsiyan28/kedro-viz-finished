const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const app = express();

let lastLog = '';
let lastStatus = 'idle';

// Serve pipeline JSON for Kedro-Viz
app.get('/api/pipeline-data', (req, res) => {
  const pipelinePath = path.join(__dirname, '../pipeline.json/api/pipelines/__default__');
  res.sendFile(pipelinePath, err => {
    if (err) {
      res.status(404).json({ error: 'pipeline.json not found' });
    }
  });
});

// Trigger Airflow DAG
app.post('/api/run-pipeline', (req, res) => {
  lastStatus = 'running';
  lastLog = 'Starting pipeline execution...';
  exec('airflow dags trigger kedro_pipeline', (error, stdout, stderr) => {
    if (error) {
      lastStatus = 'error';
      lastLog += '\nFailed to trigger Airflow DAG\n' + stderr;
      return res.status(500).json({ error: 'Failed to trigger Airflow DAG', details: stderr });
    }
    lastStatus = 'triggered';
    lastLog += '\nAirflow DAG triggered\n' + stdout;
    res.json({ message: 'Airflow DAG triggered', output: stdout });
  });
});

// Get latest pipeline log
app.get('/api/pipeline-log', (req, res) => {
  res.json({ log: lastLog });
});

// Get current pipeline status
app.get('/api/pipeline-status', (req, res) => {
  res.json({ status: lastStatus });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
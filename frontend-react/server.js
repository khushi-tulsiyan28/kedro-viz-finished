const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const simpleGit = require('simple-git');
const fs = require('fs');
const axios = require('axios');

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
app.post('/api/run-pipeline', express.json(), (req, res) => {
  const { repo, hash, pipelineName, experimentId } = req.body;
  if (!repo || !hash || !pipelineName || !experimentId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  lastStatus = 'running';
  lastLog = `Starting Airflow DAG for pipeline: ${pipelineName} (repo: ${repo}, hash: ${hash}, experimentId: ${experimentId})...`;
  // Trigger Airflow DAG (kedro_pipeline)
  exec(`airflow dags trigger kedro_pipeline`, (error, stdout, stderr) => {
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

// Endpoint to pull or clone a repo and checkout a specific hash
app.post('/api/pull-repo', express.json(), async (req, res) => {
  const { repo, hash, pipelineName, experimentId, token } = req.body;
  if (!repo || !hash || !pipelineName || !experimentId || !token) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Parse repo name from URL
  const repoNameMatch = repo.match(/([\w-]+)(\.git)?$/);
  if (!repoNameMatch) {
    return res.status(400).json({ error: 'Invalid repo URL' });
  }
  const repoName = repoNameMatch[1];
  const repoPath = path.join(__dirname, '../', repoName);
  const git = simpleGit();

  try {
    if (fs.existsSync(repoPath)) {
      // Repo exists, do a pull
      await git.cwd(repoPath);
      await git.fetch();
      await git.checkout(hash);
      await git.pull('origin', hash);
      res.json({ message: 'Repo pulled and checked out to hash', repo: repoName });
    } else {
      // Repo does not exist, clone it
      // Insert token into repo URL for authentication
      let authRepo = repo;
      if (repo.startsWith('https://')) {
        authRepo = repo.replace('https://', `https://${token}@`);
      } else if (repo.startsWith('git@')) {
        // For SSH, you would need to set up SSH keys in the environment
        // This is a placeholder for SSH-based auth
        return res.status(400).json({ error: 'SSH-based cloning not implemented in this endpoint' });
      }
      await git.clone(authRepo, repoPath);
      await git.cwd(repoPath);
      await git.checkout(hash);
      res.json({ message: 'Repo cloned and checked out to hash', repo: repoName });
    }
  } catch (err) {
    res.status(500).json({ error: 'Git operation failed', details: err.message });
  }
});

// Endpoint to fetch MLflow artifacts for the latest run in an experiment
app.get('/api/mlflow/artifacts', async (req, res) => {
  const experimentId = req.query.experiment_id;
  if (!experimentId) {
    return res.status(400).json({ error: 'Missing experiment_id' });
  }
  try {
    // 1. Get latest run for the experiment
    const searchRunsResp = await axios.post('http://localhost:5000/api/2.0/mlflow/runs/search', {
      experiment_ids: [experimentId],
      order_by: ["attributes.start_time DESC"],
      max_results: 1
    });
    const runs = searchRunsResp.data.runs;
    if (!runs || runs.length === 0) {
      return res.status(404).json({ error: 'No runs found for this experiment' });
    }
    const runId = runs[0].info.run_id;
    // 2. List artifacts for the latest run
    const listArtifactsResp = await axios.get(`http://localhost:5000/api/2.0/mlflow/artifacts/list?run_id=${runId}`);
    const artifacts = (listArtifactsResp.data.files || []).map(f => ({ path: f.path, is_dir: f.is_dir }));
    res.json({ run_id: runId, artifacts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artifacts', details: err.message });
  }
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
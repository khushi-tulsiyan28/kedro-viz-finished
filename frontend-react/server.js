const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const simpleGit = require('simple-git');
const fs = require('fs');
const axios = require('axios');
const { spawn } = require('child_process');
const { Buffer } = require('buffer');

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

app.post('/api/run-pipeline', express.json(), (req, res) => {
  const { repo, hash, pipelineName, experimentId } = req.body;
  if (!repo || !hash || !pipelineName || !experimentId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  lastStatus = 'running';
  lastLog = `Starting Airflow DAG for pipeline: ${pipelineName} (repo: ${repo}, hash: ${hash}, experimentId: ${experimentId})...`;
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

app.post('/api/pull-repo', express.json(), async (req, res) => {
  const { repo, pipelineName, experimentId, token } = req.body;
  if (!repo ||  !pipelineName || !experimentId || !token) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const repoNameMatch = repo.match(/([\w-]+)(\.git)?$/);
  if (!repoNameMatch) {
    return res.status(400).json({ error: 'Invalid repo URL' });
  } const repoName = repoNameMatch[1];
  const repoPath = path.join(__dirname, '../', repoName);
  const git = simpleGit();

  try {
    if (fs.existsSync(repoPath)) {
      // Repo exists, do a pull
      await git.cwd(repoPath);
      await git.fetch();
      await git.checkout('main');
      await git.pull('origin' ,'main');
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
      await git.checkout();
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

// Endpoint to fetch MLflow artifacts for a specific run ID
app.get('/api/mlflow/artifacts/by-run-id', async (req, res) => {
  const runId = req.query.run_id;
  if (!runId) {
    return res.status(400).json({ error: 'Missing run_id' });
  }
  try {
    // List artifacts for the given run ID
    const listArtifactsResp = await axios.get(`http://localhost:5000/api/2.0/mlflow/artifacts/list?run_id=${runId}`);
    const artifacts = (listArtifactsResp.data.files || []).map(f => ({ path: f.path, is_dir: f.is_dir }));
    res.json({ run_id: runId, artifacts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artifacts', details: err.message });
  }
});

// Endpoint to fetch the actual content of an MLflow artifact by run ID and path
app.get('/api/mlflow/artifact-content', async (req, res) => {
  const runId = req.query.run_id;
  const artifactPath = req.query.path;
  if (!runId || !artifactPath) {
    return res.status(400).json({ error: 'Missing run_id or path' });
  }
  try {
    const py = spawn('python3', [
      '-c',
      `import mlflow; import sys; import base64;\nclient = mlflow.tracking.MlflowClient();\ntry:\n file_path = client.download_artifacts('${runId}', '${artifactPath}');\n with open(file_path, 'rb') as f: data = f.read();\n print(base64.b64encode(data).decode('utf-8'))\nexcept Exception as e:\n print('ERROR:', e, file=sys.stderr); sys.exit(1)`
    ]);
    let output = '';
    let error = '';
    py.stdout.on('data', (data) => { output += data.toString(); });
    py.stderr.on('data', (data) => { error += data.toString(); });
    py.on('close', (code) => {
      if (code !== 0 || error) {
        // If error contains HTML, strip it and return a generic error
        if (error.trim().startsWith('<!DOCTYPE') || error.trim().startsWith('<html')) {
          return res.status(500).json({ error: 'MLflow server returned an HTML error page. Check MLflow server and artifact path.' });
        }
        return res.status(500).json({ error: 'Failed to fetch artifact content', details: error || 'Unknown error' });
      }
      // If output looks like HTML, return error
      if (output.trim().startsWith('<!DOCTYPE') || output.trim().startsWith('<html')) {
        return res.status(500).json({ error: 'MLflow server returned an HTML error page. Check MLflow server and artifact path.' });
      }
      // Otherwise, return base64 content
      res.json({ base64: output });
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artifact content', details: err.message });
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
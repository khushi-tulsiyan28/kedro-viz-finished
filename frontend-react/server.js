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

app.get('/api/pipeline-data', (req, res) => {
  const pipelinePath = path.join(__dirname, '../pipeline.json');
  res.sendFile(pipelinePath, err => {
    if (err) {
      res.status(404).json({ error: 'pipeline.json not found' });
    }
  });
});

app.post('/api/run-pipeline', express.json(), (req, res) => {
  const { repo, pipelineName, experimentId } = req.body;
  if (!repo || !pipelineName || !experimentId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  lastStatus = 'running';
  lastLog = `Starting Airflow DAG for pipeline: ${pipelineName} (repo: ${repo}, experimentId: ${experimentId})...`;
  exec(`airflow dags trigger kedro_pipeline`, (error, stdout, stderr) => {
    if (error) {
      lastStatus = 'error';
      lastLog += '\nFailed to trigger Airflow DAG\n' + stderr;
      return res.status(500).json({ error: 'Failed to trigger Airflow DAG', details: stderr });
    }
    lastStatus = 'triggered';
    lastLog += '\nAirflow DAG triggered\n' + stdout;
    console.log('Airflow trigger output:', stdout);
    let joined = stdout.replace(/\n|\r/g, ' ');
    const lines = stdout.split('\n');
    let runIdCol = -1;
    let run_id = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('dag_run_id')) {
        const headers = line.split('|').map(h => h.trim());
        runIdCol = headers.indexOf('dag_run_id');
        continue;
      }
      if (runIdCol !== -1 && line.includes('manual__')) {
        const cols = line.split('|').map(c => c.trim());
        const firstPart = cols[runIdCol];
        if (i + 1 < lines.length) {
          const nextCols = lines[i + 1].split('|').map(c => c.trim());
          if (nextCols[runIdCol] && nextCols[runIdCol].length > 0) {
            run_id = firstPart + nextCols[runIdCol];
          } else {
            run_id = firstPart;
          }
        } else {
          run_id = firstPart;
        }
        break;
      }
    }
    console.log('Extracted run_id:', run_id);
    if (!run_id) {
      console.error('Could not parse Airflow run_id from output:', stdout);
      return res.status(500).json({ error: 'Could not parse Airflow run_id from output', output: stdout });
    }
    res.json({ message: 'Airflow DAG triggered', output: stdout, run_id });
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
      await git.cwd(repoPath);
      await git.fetch();
      await git.checkout('origin','main');
      await git.pull('origin' ,'main');
      res.json({ message: 'Repo pulled and checked out to hash', repo: repoName });
    } else {
      
      let authRepo = repo;
      if (repo.startsWith('https://')) {
        authRepo = repo.replace('https://', `https://${token}@`);
      } else if (repo.startsWith('git@')) {
        
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

app.get('/api/mlflow/artifacts', async (req, res) => {
  const experimentId = req.query.experiment_id;
  if (!experimentId) {
    return res.status(400).json({ error: 'Missing experiment_id' });
  }
  try {
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
    const listArtifactsResp = await axios.get(`http://localhost:5000/api/2.0/mlflow/artifacts/list?run_id=${runId}`);
    const artifacts = (listArtifactsResp.data.files || []).map(f => ({ path: f.path, is_dir: f.is_dir }));
    res.json({ run_id: runId, artifacts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artifacts', details: err.message });
  }
});

app.get('/api/mlflow/artifacts/by-run-id', async (req, res) => {
  const runId = req.query.run_id;
  if (!runId) {
    return res.status(400).json({ error: 'Missing run_id' });
  }
  try {
    const listArtifactsResp = await axios.get(`http://localhost:5000/api/2.0/mlflow/artifacts/list?run_id=${runId}`);
    const artifacts = (listArtifactsResp.data.files || []).map(f => ({ path: f.path, is_dir: f.is_dir }));
    res.json({ run_id: runId, artifacts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artifacts', details: err.message });
  }
});

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
        if (error.trim().startsWith('<!DOCTYPE') || error.trim().startsWith('<html')) {
          return res.status(500).json({ error: 'MLflow server returned an HTML error page. Check MLflow server and artifact path.' });
        }
        return res.status(500).json({ error: 'Failed to fetch artifact content', details: error || 'Unknown error' });
      }
      if (output.trim().startsWith('<!DOCTYPE') || output.trim().startsWith('<html')) {
        return res.status(500).json({ error: 'MLflow server returned an HTML error page. Check MLflow server and artifact path.' });
      }
      res.json({ base64: output });
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artifact content', details: err.message });
  }
});

app.get('/api/airflow-log', (req, res) => {
  const { dag_id, run_id, task_id, attempt } = req.query;
  if (!dag_id || !run_id || !task_id) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  const attemptNum = attempt || 1;
  const logPath = path.join(
    process.env.HOME,
    'airflow',
    'logs',
    `dag_id=${dag_id}`,
    `run_id=${run_id}`,
    `task_id=${task_id}`,
    `attempt=${attemptNum}.log`
  );
  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).json({ error: 'Log file not found', details: err.message });
    }
    res.json({ log: data });
  });
});

app.get('/api/pipeline-log', (req, res) => {
  res.json({ log: lastLog });
});

app.get('/api/pipeline-status', (req, res) => {
  res.json({ status: lastStatus });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
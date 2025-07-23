import React, { useEffect, useState, useRef } from 'react';

function fetchAirflowLog({ dagId, runId, taskId, attempt = 1 }) {
  const params = new URLSearchParams({
    dag_id: dagId,
    run_id: runId,
    task_id: taskId,
    attempt,
  });
  return fetch(`/api/airflow-log?${params.toString()}`)
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch log');
      }
      return response.json();
    })
    .then((data) => data.log);
}

const ExecutionLog = ({ dagId, runId, taskId, attempt }) => {
  const [log, setLog] = useState('');
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);
  const intervalRef = useRef();

  useEffect(() => {
    setLog('');
    setError('');
    setWaiting(false);
    if (!runId) return;

    const pollLog = async () => {
      try {
        const logData = await fetchAirflowLog({ dagId, runId, taskId, attempt });
        setLog(logData);
        setError('');
        setWaiting(false);
      } catch (err) {
        if (err.message === 'Log file not found') {
          setWaiting(true);
          setError('');
        } else {
          setError(err.message);
          setWaiting(false);
        }
      }
    };

    pollLog();
    intervalRef.current = setInterval(pollLog, 3000);
    return () => clearInterval(intervalRef.current);
  }, [dagId, runId, taskId, attempt]);

  if (!runId) return null;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (waiting) return <div>Waiting for log...</div>;
  if (!log) return <div>Loading execution log...</div>;
  return (
    <pre style={{ background: '#222', color: '#0f0', padding: '1em', overflowX: 'auto', maxHeight: '400px' }}>
      {log}
    </pre>
  );
};

export default ExecutionLog; 
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('start_pipeline', () => {
    // Start Kedro pipeline as a child process
    const kedro = spawn('kedro', ['run'], {
      cwd: path.join(__dirname, '..'),
      shell: true
    });

    // Send pipeline output to frontend
    kedro.stdout.on('data', (data) => {
      const output = data.toString();
      socket.emit('pipeline_output', output);
      
      // Simple parsing of node completion
      if (output.includes('Completed')) {
        const nodeMatch = output.match(/node: (\w+)/);
        if (nodeMatch) {
          socket.emit('node_complete', { node: nodeMatch[1] });
        }
      }
    });

    kedro.stderr.on('data', (data) => {
      socket.emit('pipeline_error', data.toString());
    });

    kedro.on('close', (code) => {
      socket.emit('pipeline_complete', { code });
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});

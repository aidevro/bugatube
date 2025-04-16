const express = require('express');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5152;

// Middleware
app.use(cors({ origin: 'http://89.33.193.13:5151' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  setHeaders: (res, path) => {
    console.log(`Serving file: ${path}`);
  }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/videos', require('./routes/videos'));

app.get('/', (req, res) => res.send('BugaTube API'));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Start server
const server = app.listen(port, () => console.log(`Server running on port ${port}`));

// WebSocket setup
let wss = new WebSocket.Server({ server });

// Heartbeat mechanism to keep connections alive
function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('WebSocket message received:', data);
      if (data.type === 'auth' && data.token) {
        const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
        ws.userId = decoded.id; // Associate WebSocket client with user ID
        console.log(`WebSocket client authenticated with user ID: ${ws.userId}`);
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('error', (err) => console.error('WebSocket error:', err));
  ws.on('close', (code, reason) => console.log('WebSocket client disconnected. Code:', code, 'Reason:', reason));
});

// Ping clients every 30 seconds to keep connections alive
const interval = setInterval(() => {
  if (wss && wss.clients) {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) {
        console.log('Terminating WebSocket client due to missed heartbeat');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  } else {
    console.error('WebSocket server (wss) not initialized for heartbeat');
  }
}, 30000);

wss.on('close', () => {
  console.log('WebSocket server closed');
  clearInterval(interval);
});

module.exports = { app, wss };

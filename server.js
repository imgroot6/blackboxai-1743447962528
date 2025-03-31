const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 8000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Socket.io for real-time communication
io.on('connection', (socket) => {
  console.log('New client connected');

  // Handle WebRTC signaling
  socket.on('signal', (data) => {
    socket.broadcast.emit('signal', data);
  });

  // Handle PIN verification
  socket.on('verify-pin', (pin) => {
    // In a real app, verify PIN against database
    socket.emit('pin-verified', { valid: true });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// All routes serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
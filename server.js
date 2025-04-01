const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 8000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Enhanced Socket.io for virtual date features
io.on('connection', (socket) => {
  console.log('New client connected');
  let currentRoom = null;

  // Handle WebRTC signaling
  socket.on('signal', (data) => {
    socket.broadcast.emit('signal', data);
  });

  // Handle room joining with PIN
  socket.on('join-room', ({ pin, userId }) => {
    currentRoom = `room_${pin}`;
    socket.join(currentRoom);
    socket.emit('room-joined', { success: true });
    
    // Notify other users in room
    socket.to(currentRoom).emit('user-joined', { userId });
  });

  // Media synchronization events
  socket.on('sync-playback', ({ time, state, mediaId }) => {
    socket.to(currentRoom).emit('playback-update', { time, state, mediaId });
  });

  // Watch party controls
  socket.on('playlist-update', (playlist) => {
    socket.to(currentRoom).emit('playlist-changed', playlist);
  });

  // Track game room users
  const gameRooms = {};

  // Game state synchronization
  socket.on('game-event', (event) => {
    socket.to(currentRoom).emit('game-update', event);
  });

  // Game room management
  socket.on('join-room', ({ pin, type }) => {
    if (type === 'game') {
      const roomId = `room_${pin}`;
      if (!gameRooms[roomId]) {
        gameRooms[roomId] = [];
      }
      gameRooms[roomId].push(socket.id);
      io.to(roomId).emit('room-status', { 
        users: gameRooms[roomId],
        host: gameRooms[roomId][0] // First user is host
      });
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && currentRoom.startsWith('room_')) {
      const pin = currentRoom.substring(5);
      if (gameRooms[currentRoom]) {
        gameRooms[currentRoom] = gameRooms[currentRoom].filter(id => id !== socket.id);
        if (gameRooms[currentRoom].length > 0) {
          io.to(currentRoom).emit('room-status', { 
            users: gameRooms[currentRoom],
            host: gameRooms[currentRoom][0] // New host
          });
        } else {
          delete gameRooms[currentRoom];
        }
      }
    }
  });

  // Filter application
  socket.on('apply-filter', (filter) => {
    socket.to(currentRoom).emit('filter-applied', filter);
  });

  // Chat messages
  socket.on('send-message', (message) => {
    socket.to(currentRoom).emit('new-message', message);
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      socket.to(currentRoom).emit('user-left', { userId: socket.id });
    }
    console.log('Client disconnected');
  });
});

// All routes serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const net = require('net');

const getAvailablePort = (desiredPort) => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen({port: desiredPort}, () => {
      const {port} = server.address();
      server.close(() => resolve(port));
    });
  }).catch(() => getAvailablePort(desiredPort + 1));
};

const startServer = async () => {
  try {
    const port = await getAvailablePort(PORT);
    const runningServer = server.listen(port, () => {
      console.log(`HEY BUDDY server running on http://localhost:${port}`);
    });
    
    process.on('SIGTERM', () => runningServer.close());
    process.on('SIGINT', () => runningServer.close());
    
    return runningServer;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

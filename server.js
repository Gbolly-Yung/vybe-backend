const db = require('./src/config/database');
const authRoutes = require('./src/routes/authRoutes');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({
    message: 'VYBE API is running! 🚀',
    version: '1.0.0',
    status: 'online',
  });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on('send_message', (data) => {
    io.to(data.room).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Keep server awake on Render free tier
const https = require('https');
setInterval(() => {
  https.get('https://vybe-backend-vt91.onrender.com', (res) => {
    console.log('Server kept alive:', res.statusCode);
  }).on('error', (err) => {
    console.log('Keep alive error:', err.message);
  });
}, 14 * 60 * 1000); // Every 14 minutes

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`VYBE Server running on port ${PORT} 🚀`);
});
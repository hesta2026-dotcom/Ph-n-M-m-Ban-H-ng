require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Cho phép nhiều origin: localhost dev + Vercel production
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin không được phép'));
  },
  credentials: true,
};

const io = new Server(server, { cors: { origin: allowedOrigins.length ? allowedOrigins : '*', methods: ['GET', 'POST'] } });

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(require('path').join(__dirname, '../uploads')));

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/categories',require('./routes/categories'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/stock',     require('./routes/stock'));
app.use('/api/expenses',  require('./routes/expenses'));
app.use('/api/debts',     require('./routes/debts'));
app.use('/api/channels',  require('./routes/channels'));
app.use('/api/shifts',    require('./routes/shifts'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/reports',   require('./routes/reports'));
app.use('/api/audit',     require('./routes/audit'));

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('order:new', (data) => socket.broadcast.emit('order:new', data));
  socket.on('stock:update', (data) => socket.broadcast.emit('stock:update', data));
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

app.set('io', io);

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Tự động import data nếu có backup/data.json
  const backupFile = path.join(__dirname, '../../backup/data.json');
  if (fs.existsSync(backupFile)) {
    try {
      console.log('Phát hiện backup/data.json — đang import...');
      await require('./scripts/import-silent')();
    } catch (e) {
      console.error('Import data thất bại:', e.message);
    }
  }

  server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

startServer();

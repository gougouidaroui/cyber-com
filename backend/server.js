const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDB } = require('./database');
const authRoutes = require('./routes/auth');
const keysRoutes = require('./routes/keys');
const messagesRoutes = require('./routes/messages');
const attackRoutes = require('./routes/attack');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

initDB();

app.use('/api/auth', authRoutes);
app.use('/api/keys', keysRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/attack', attackRoutes);
app.use('/api/users', usersRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CyberCom API running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
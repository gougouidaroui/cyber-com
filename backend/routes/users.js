const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.id;

  const stmt = db.prepare('SELECT id, username FROM users WHERE id != ?');
  stmt.all(userId, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json({ users: rows });
  });
});

module.exports = router;
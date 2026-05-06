const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { generateToken } = require('../middleware/auth');
const { generateKeyPair: generateMHKeyPair } = require('../crypto/merkle-hellman');
const { generateKeyPair: generateEGKeyPair } = require('../crypto/elgamal');

const router = express.Router();

router.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const checkStmt = db.prepare('SELECT id FROM users WHERE username = ?');
  checkStmt.get(username, (err, user) => {
    if (user) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);

    const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    insertUser.run(username, hash, function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create user' });
      }

const userId = this.lastID;

      const mhKeys = generateMHKeyPair(8);
      const egKeys = generateEGKeyPair(16);

      const insertKeys = db.prepare(`
        INSERT INTO user_keys (user_id, mh_public_key, mh_private_key, eg_public_key, eg_private_key)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertKeys.run(
        userId,
        JSON.stringify(mhKeys.publicKey),
        JSON.stringify(mhKeys.privateKey),
        JSON.stringify(egKeys.publicKey),
        JSON.stringify(egKeys.privateKey),
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to generate keys' });
          }

          const token = generateToken({ id: userId, username });

          res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: userId, username }
          });
        }
      );
    });
  });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  stmt.get(username, (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.id, username: user.username });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username }
    });
  });
});

module.exports = router;
const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/my', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const sessionToken = req.user.sessionToken;

  if (!sessionToken) {
    return res.status(401).json({ error: 'No active session' });
  }

  const checkSession = db.prepare(`
    SELECT is_active, expires_at FROM session_keys
    WHERE user_id = ? AND session_token = ? AND is_active = 1
  `);

  checkSession.get(userId, sessionToken, (err, session) => {
    if (err || !session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (new Date(session.expires_at) < new Date()) {
      const updateSession = db.prepare(`UPDATE session_keys SET is_active = 0 WHERE user_id = ?`);
      updateSession.run(userId);
      return res.status(401).json({ error: 'Session expired, please login again' });
    }

    const stmt = db.prepare(`
      SELECT mh_public_key, mh_private_key_encrypted, eg_public_key, eg_private_key_encrypted
      FROM user_keys WHERE user_id = ?
    `);

    stmt.get(userId, (err, keys) => {
      if (err || !keys) {
        return res.status(404).json({ error: 'Keys not found' });
      }

      res.json({
        mhPublicKey: JSON.parse(keys.mh_public_key),
        mhPrivateKeyEncrypted: keys.mh_private_key_encrypted,
        egPublicKey: JSON.parse(keys.eg_public_key),
        egPrivateKeyEncrypted: keys.eg_private_key_encrypted
      });
    });
  });
});

router.get('/unlock', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const sessionToken = req.user.sessionToken;

  if (!sessionToken) {
    return res.status(401).json({ error: 'No active session' });
  }

  const checkSession = db.prepare(`
    SELECT is_active, expires_at FROM session_keys
    WHERE user_id = ? AND session_token = ? AND is_active = 1
  `);

  checkSession.get(userId, sessionToken, (err, session) => {
    if (err || !session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (new Date(session.expires_at) < new Date()) {
      const updateSession = db.prepare(`UPDATE session_keys SET is_active = 0 WHERE user_id = ?`);
      updateSession.run(userId);
      return res.status(401).json({ error: 'Session expired, please login again' });
    }

    const timestamp = Date.now();
    const expiryMs = Math.floor(Math.random() * 400) + 100;
    const expiresAt = timestamp + expiryMs;

    res.json({
      timestamp,
      expiresAt,
      sessionToken
    });
  });
});

router.get('/:userId', authenticateToken, (req, res) => {
  const targetUserId = parseInt(req.params.userId);

  if (isNaN(targetUserId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const stmt = db.prepare(`
    SELECT user_id, mh_public_key, eg_public_key
    FROM user_keys WHERE user_id = ?
  `);

  stmt.get(targetUserId, (err, keys) => {
    if (err || !keys) {
      return res.status(404).json({ error: 'User or keys not found' });
    }

    res.json({
      userId: keys.user_id,
      mhPublicKey: JSON.parse(keys.mh_public_key),
      egPublicKey: JSON.parse(keys.eg_public_key)
    });
  });
});

module.exports = router;
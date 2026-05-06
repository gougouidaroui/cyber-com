const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/my', authenticateToken, (req, res) => {
  const userId = req.user.id;

  const stmt = db.prepare(`
    SELECT mh_public_key, mh_private_key, eg_public_key, eg_private_key
    FROM user_keys WHERE user_id = ?
  `);

  stmt.get(userId, (err, keys) => {
    if (err || !keys) {
      return res.status(404).json({ error: 'Keys not found' });
    }

    res.json({
      mhPublicKey: JSON.parse(keys.mh_public_key),
      mhPrivateKey: JSON.parse(keys.mh_private_key),
      egPublicKey: JSON.parse(keys.eg_public_key),
      egPrivateKey: JSON.parse(keys.eg_private_key)
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
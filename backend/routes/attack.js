const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { attack, attackOnBlocks } = require('../crypto/attack');
const { generateKeyPair } = require('../crypto/merkle-hellman');
const { messageToBlocks } = require('../crypto/merkle-hellman');

const router = express.Router();

router.get('/intercepted', authenticateToken, (req, res) => {
  const stmt = db.prepare(`
    SELECT im.id, im.ciphertext, im.mh_public_key, im.intercepted_at,
           u1.username as from_username, u2.username as to_username
    FROM intercepted_messages im
    JOIN users u1 ON im.from_user_id = u1.id
    JOIN users u2 ON im.to_user_id = u2.id
    ORDER BY im.intercepted_at DESC
  `);

  stmt.all((err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch intercepted messages' });
    }

    const messages = rows.map(row => ({
      id: row.id,
      fromUsername: row.from_username,
      toUsername: row.to_username,
      ciphertext: JSON.parse(row.ciphertext),
      mhPublicKey: JSON.parse(row.mh_public_key),
      interceptedAt: row.intercepted_at
    }));

    res.json({ messages });
  });
});

router.post('/intercept', authenticateToken, (req, res) => {
  const { fromUserId, toUserId, message } = req.body;

  const fromId = parseInt(fromUserId);
  const toId = parseInt(toUserId);

  if (isNaN(fromId) || isNaN(toId) || !message) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  const getKeysStmt = db.prepare('SELECT mh_public_key FROM user_keys WHERE user_id = ?');
  getKeysStmt.get(toId, (err, keys) => {
    if (err || !keys) {
      return res.status(404).json({ error: 'Target user not found or has no keys' });
    }

    const mhPub = JSON.parse(keys.mh_public_key);
    const mhCiphertexts = require('../crypto/merkle-hellman').encrypt(message, mhPub);

    const ciphertext = JSON.stringify(mhCiphertexts);

    const insertStmt = db.prepare(`
      INSERT INTO intercepted_messages (from_user_id, to_user_id, ciphertext, mh_public_key)
      VALUES (?, ?, ?, ?)
    `);

    insertStmt.run(fromId, toId, ciphertext, keys.mh_public_key, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to intercept message' });
      }

      res.status(201).json({ message: 'Message intercepted and stored for demo' });
    });
  });
});

router.post('/run', authenticateToken, (req, res) => {
  const { mhPublicKey, ciphertext, messageId } = req.body;

  if (!mhPublicKey || !ciphertext) {
    return res.status(400).json({ error: 'Public key and ciphertext required' });
  }

  try {
    const mhPub = typeof mhPublicKey === 'string' ? JSON.parse(mhPublicKey) : mhPublicKey;
    const ciphertextObj = typeof ciphertext === 'string' ? JSON.parse(ciphertext) : ciphertext;

    let mhCiphertexts;
    if (Array.isArray(ciphertextObj)) {
      mhCiphertexts = ciphertextObj;
    } else if (ciphertextObj.mh) {
      mhCiphertexts = ciphertextObj.mh;
    } else {
      return res.status(400).json({ error: 'Invalid ciphertext format' });
    }

    if (mhCiphertexts.length === 1) {
      const result = attack(mhPub, mhCiphertexts[0]);

      if (messageId) {
        const updateStmt = db.prepare(`
          UPDATE intercepted_messages SET attack_result = ? WHERE id = ?
        `);
        updateStmt.run(JSON.stringify(result), messageId);
      }

      return res.json(result);
    } else {
      const result = attackOnBlocks(mhPub, mhCiphertexts);

      if (messageId) {
        const updateStmt = db.prepare(`
          UPDATE intercepted_messages SET attack_result = ? WHERE id = ?
        `);
        updateStmt.run(JSON.stringify(result), messageId);
      }

      return res.json(result);
    }
  } catch (e) {
    res.status(500).json({ error: 'Attack failed: ' + e.message });
  }
});

router.get('/demo-data', authenticateToken, (req, res) => {
  const mhKeys = generateKeyPair(8);
  const testMessage = 'HELLO';

  const mhCiphertexts = require('../crypto/merkle-hellman').encrypt(testMessage, mhKeys.publicKey);

  res.json({
    publicKey: mhKeys.publicKey,
    ciphertext: mhCiphertexts,
    originalMessage: testMessage
  });
});

module.exports = router;
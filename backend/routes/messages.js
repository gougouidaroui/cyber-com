const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { encrypt: mhEncrypt, decrypt: mhDecrypt } = require('../crypto/merkle-hellman');
const { encryptBigInt: egEncrypt, decryptBigInt: egDecrypt } = require('../crypto/elgamal');

const router = express.Router();

router.get('/conversations', authenticateToken, (req, res) => {
  const userId = req.user.id;

  const stmt = db.prepare(`
    SELECT DISTINCT
      CASE
        WHEN sender_id = ? THEN receiver_id
        ELSE sender_id
      END as partner_id
    FROM messages
    WHERE sender_id = ? OR receiver_id = ?
  `);

  stmt.all(userId, userId, userId, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }

    if (rows.length === 0) {
      return res.json({ conversations: [] });
    }

    const partnerIds = rows.map(r => r.partner_id);
    const placeholders = partnerIds.map(() => '?').join(',');

    const userStmt = db.prepare(`
      SELECT id, username FROM users WHERE id IN (${placeholders})
    `);

    userStmt.all(...partnerIds, (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch users' });
      }

      res.json({ conversations: users });
    });
  });
});

router.get('/:userId', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const partnerId = parseInt(req.params.userId);

  if (isNaN(partnerId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const stmt = db.prepare(`
    SELECT id, sender_id, receiver_id, ciphertext, created_at
    FROM messages
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
  `);

  stmt.all(userId, partnerId, partnerId, userId, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    const messages = rows.map(row => {
      return {
        id: row.id,
        sender_id: row.sender_id,
        receiver_id: row.receiver_id,
        ciphertext: row.ciphertext,
        message: '[ENCRYPTED]',
        created_at: row.created_at
      };
    });

    res.json({ messages });
  });
});

router.post('/send', authenticateToken, (req, res) => {
  const senderId = req.user.id;
  const { receiverId, ciphertext } = req.body;

  if (!receiverId || !ciphertext) {
    return res.status(400).json({ error: 'Receiver ID and ciphertext are required' });
  }

  const receiverIdNum = parseInt(receiverId);
  if (isNaN(receiverIdNum)) {
    return res.status(400).json({ error: 'Invalid receiver ID' });
  }

  const insertMsg = db.prepare(`
    INSERT INTO messages (sender_id, receiver_id, ciphertext) VALUES (?, ?, ?)
  `);

  insertMsg.run(senderId, receiverIdNum, ciphertext, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to send message' });
    }

    res.status(201).json({ message: 'Message sent successfully' });
  });
});

router.get('/decrypt/:messageId', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const messageId = parseInt(req.params.messageId);

  if (isNaN(messageId)) {
    return res.status(400).json({ error: 'Invalid message ID' });
  }

  const msgStmt = db.prepare(`
    SELECT sender_id, receiver_id, ciphertext FROM messages WHERE id = ?
  `);

  msgStmt.get(messageId, (err, msg) => {
    if (err || !msg) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (msg.sender_id !== userId && msg.receiver_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to decrypt this message' });
    }

    const getMyKeys = db.prepare(`
      SELECT mh_private_key, eg_private_key FROM user_keys WHERE user_id = ?
    `);

    getMyKeys.get(userId, (err, myKeys) => {
      if (err || !myKeys) {
        return res.status(500).json({ error: 'Keys not found' });
      }

      const myMHPriv = JSON.parse(myKeys.mh_private_key);
      const myEGPriv = JSON.parse(myKeys.eg_private_key);

      try {
        const ciphertextObj = JSON.parse(msg.ciphertext);
        const mhCiphertexts = ciphertextObj.mh;
        const egCiphertexts = ciphertextObj.eg;

        const mhDecrypted = egCiphertexts.map(egCt => {
          const mhCt = egDecrypt(egCt, myEGPriv);
          return mhCt;
        });

        const decryptedMessage = mhDecrypt(mhDecrypted, myMHPriv);

        res.json({ message: decryptedMessage });
      } catch (e) {
        res.status(500).json({ error: 'Decryption failed: ' + e.message });
      }
    });
  });
});

router.get('/all/for-attack', authenticateToken, (req, res) => {
  const userId = req.user.id;

  const stmt = db.prepare(`
    SELECT m.id, m.sender_id, m.receiver_id, m.ciphertext, m.created_at,
           u1.username as sender_username, u2.username as receiver_username,
           k.mh_public_key
    FROM messages m
    JOIN users u1 ON m.sender_id = u1.id
    JOIN users u2 ON m.receiver_id = u2.id
    LEFT JOIN user_keys k ON 
      CASE 
        WHEN m.sender_id = ? THEN m.receiver_id = k.user_id 
        ELSE m.sender_id = k.user_id 
      END = 1
    WHERE m.sender_id = ? OR m.receiver_id = ?
    ORDER BY m.id DESC
  `);

  stmt.all(userId, userId, userId, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    const messages = rows.map(row => {
      const isSent = row.sender_id === userId;
      return {
        id: row.id,
        senderId: row.sender_id,
        receiverId: row.receiver_id,
        otherUsername: isSent ? row.receiver_username : row.sender_username,
        ciphertext: row.ciphertext,
        mhPublicKey: row.mh_public_key ? JSON.parse(row.mh_public_key) : null,
        createdAt: row.created_at,
        direction: isSent ? 'sent' : 'received'
      };
    });

    res.json({ messages });
  });
});

module.exports = router;
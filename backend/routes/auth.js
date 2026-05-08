const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { generateToken } = require('../middleware/auth');
const { generateKeyPair: generateMHKeyPair } = require('../crypto/merkle-hellman');
const { generateKeyPair: generateEGKeyPair } = require('../crypto/elgamal');
const { encryptPrivateKey, generateSessionToken } = require('../crypto/keyCrypto');

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

      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

      const mhPrivateKeyEncrypted = encryptPrivateKey(
        mhKeys.privateKey,
        password,
        sessionToken
      );
      const egPrivateKeyEncrypted = encryptPrivateKey(
        egKeys.privateKey,
        password,
        sessionToken
      );

      const insertKeys = db.prepare(`
        INSERT INTO user_keys (user_id, mh_public_key, mh_private_key_encrypted, eg_public_key, eg_private_key_encrypted)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertKeys.run(
        userId,
        JSON.stringify(mhKeys.publicKey),
        mhPrivateKeyEncrypted,
        JSON.stringify(egKeys.publicKey),
        egPrivateKeyEncrypted,
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to generate keys' });
          }

          const insertSession = db.prepare(`
            INSERT INTO session_keys (user_id, session_token, expires_at)
            VALUES (?, ?, ?)
          `);

          insertSession.run(userId, sessionToken, expiresAt, (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to create session' });
            }

            const token = generateToken({ id: userId, username, sessionToken });

            res.status(201).json({
              message: 'User registered successfully',
              token,
              sessionToken,
              user: { id: userId, username },
              mhPublicKey: mhKeys.publicKey,
              egPublicKey: egKeys.publicKey
            });
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

    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const updateSession = db.prepare(`
      UPDATE session_keys SET is_active = 0 WHERE user_id = ?
    `);
    updateSession.run(user.id, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to update sessions' });
      }

      const insertSession = db.prepare(`
        INSERT INTO session_keys (user_id, session_token, expires_at)
        VALUES (?, ?, ?)
      `);

      insertSession.run(user.id, sessionToken, expiresAt, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to create session' });
        }

        const getKeys = db.prepare(`
          SELECT mh_public_key, mh_private_key_encrypted, eg_public_key, eg_private_key_encrypted
          FROM user_keys WHERE user_id = ?
        `);

        getKeys.get(user.id, (err, keys) => {
          if (err || !keys) {
            return res.status(500).json({ error: 'Keys not found' });
          }

          const mhPrivateKeyEncrypted = keys.mh_private_key_encrypted;
          const egPrivateKeyEncrypted = keys.eg_private_key_encrypted;

          const decryptOld = require('../crypto/keyCrypto').decryptPrivateKey;

          const getOldSession = db.prepare(`
            SELECT session_token FROM session_keys
            WHERE user_id = ? AND is_active = 0
            ORDER BY created_at DESC LIMIT 1
          `);

          getOldSession.get(user.id, (err, oldSession) => {
            const oldToken = oldSession ? oldSession.session_token : '';

            let mhPriv, egPriv;
            try {
              mhPriv = decryptOld(mhPrivateKeyEncrypted, password, oldToken);
              egPriv = decryptOld(egPrivateKeyEncrypted, password, oldToken);
            } catch (e) {
              console.log('Decryption with old session failed, regenerating keys');
              const mhGen = generateMHKeyPair(8);
              const egGen = generateEGKeyPair(16);
              mhPriv = mhGen.privateKey;
              egPriv = egGen.privateKey;
            }

            const newMhPrivateKeyEncrypted = encryptPrivateKey(mhPriv, password, sessionToken);
            const newEgPrivateKeyEncrypted = encryptPrivateKey(egPriv, password, sessionToken);

            const updateKeys = db.prepare(`
              UPDATE user_keys SET mh_private_key_encrypted = ?, eg_private_key_encrypted = ? WHERE user_id = ?
            `);

            updateKeys.run(newMhPrivateKeyEncrypted, newEgPrivateKeyEncrypted, user.id, (err) => {
              if (err) {
                return res.status(500).json({ error: 'Failed to update keys' });
              }

              const token = generateToken({ id: user.id, username, sessionToken });

              res.json({
                message: 'Login successful',
                token,
                sessionToken,
                user: { id: user.id, username: user.username },
                mhPublicKey: JSON.parse(keys.mh_public_key),
                egPublicKey: JSON.parse(keys.eg_public_key)
              });
            });
          });
        });
      });
    });
  });
});

router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = require('../middleware/auth').verifyToken(token);

    const deleteMessages = db.prepare(`DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?`);
    deleteMessages.run(decoded.id, decoded.id, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete messages' });
      }

      const updateSession = db.prepare(`UPDATE session_keys SET is_active = 0 WHERE user_id = ?`);
      updateSession.run(decoded.id, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ message: 'Logged out successfully' });
      });
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
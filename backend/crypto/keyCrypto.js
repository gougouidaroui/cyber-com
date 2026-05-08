const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

function deriveKey(password, sessionToken, timestamp) {
  const combinedInput = `${password}${sessionToken}${timestamp}`;
  return crypto.createHash('sha256').update(combinedInput).digest();
}

function encryptPrivateKey(privateKey, password, sessionToken) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, sessionToken, '');

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(JSON.stringify(privateKey), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted
  });
}

function decryptPrivateKey(encryptedData, password, sessionToken) {
  const parsed = JSON.parse(encryptedData);

  const iv = Buffer.from(parsed.iv, 'hex');
  const authTag = Buffer.from(parsed.authTag, 'hex');
  const encrypted = parsed.data;

  const key = deriveKey(password, sessionToken, '');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  encryptPrivateKey,
  decryptPrivateKey,
  generateSessionToken
};
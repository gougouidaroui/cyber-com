const path = require('path');
module.paths.unshift(path.join(__dirname, 'backend', 'node_modules'));

const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'backend', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function dotProduct(v1, v2) {
  return v1.reduce((sum, val, i) => sum + val * v2[i], 0);
}

function gramSchmidt(basis) {
  const k = basis.length;
  const n = basis[0].length;
  const u = [];
  const mu = [];

  for (let i = 0; i < k; i++) {
    u[i] = [...basis[i]];
    mu[i] = [];
    for (let j = 0; j < i; j++) {
      const u_j_norm_sq = dotProduct(u[j], u[j]);
      mu[i][j] = u_j_norm_sq === 0 ? 0 : dotProduct(basis[i], u[j]) / u_j_norm_sq;
      for (let l = 0; l < n; l++) {
        u[i][l] -= mu[i][j] * u[j][l];
      }
    }
  }
  return { u, mu };
}

function lll(matrix, delta = 0.75) {
  const k = matrix.length;
  const n = matrix[0].length;
  let basis = matrix.map(row => [...row]);

  let k_idx = 1;
  while (k_idx < k) {
    const { u, mu } = gramSchmidt(basis);

    for (let j = k_idx - 1; j >= 0; j--) {
      if (Math.abs(mu[k_idx][j]) > 0.5) {
        const q = Math.round(mu[k_idx][j]);
        for (let l = 0; l < n; l++) {
          basis[k_idx][l] -= q * basis[j][l];
        }
        const gs = gramSchmidt(basis);
        for (let i = 0; i < k; i++) {
          u[i] = gs.u[i];
          mu[i] = gs.mu[i];
        }
      }
    }

    const u_k_minus_1_norm_sq = dotProduct(u[k_idx - 1], u[k_idx - 1]);
    const u_k_norm_sq = dotProduct(u[k_idx], u[k_idx]);
    const mu_k_k_minus_1 = mu[k_idx][k_idx - 1];

    if (u_k_norm_sq < (delta - mu_k_k_minus_1 * mu_k_k_minus_1) * u_k_minus_1_norm_sq) {
      const temp = basis[k_idx];
      basis[k_idx] = basis[k_idx - 1];
      basis[k_idx - 1] = temp;
      k_idx = Math.max(k_idx - 1, 1);
    } else {
      k_idx++;
    }
  }

  return basis;
}

function attackBlock(B, c) {
  const n = B.length;
  const matrixSize = n + 1;
  const matrix = [];
  const N = 100;

  for (let i = 0; i < n; i++) {
    const row = new Array(matrixSize).fill(0);
    row[i] = 1;
    row[n] = B[i] * N;
    matrix.push(row);
  }

  const lastRow = new Array(matrixSize).fill(0);
  lastRow[n] = -c * N;
  matrix.push(lastRow);

  const reduced = lll(matrix, 0.75);

  for (const row of reduced) {
    if (row[n] !== 0) continue;

    const v = row.slice(0, n);
    const isBinary = v.every(val => Math.abs(val - 1) < 0.1 || Math.abs(val) < 0.1);
    const isNegBinary = v.every(val => Math.abs(val + 1) < 0.1 || Math.abs(val) < 0.1);

    if (v.every(val => Math.abs(val) < 0.1)) continue;

    if (isBinary) {
      return v.map(Math.round).map(val => val === 1 ? '1' : '0').join('');
    } else if (isNegBinary) {
      return v.map(val => Math.round(-val)).map(val => val === 1 ? '1' : '0').join('');
    }
  }

  return null;
}

function attackMessage(publicKey, ciphertexts) {
  const B = publicKey.B.map(b => Number(b));
  let fullMessage = '';

  for (const ciphertext of ciphertexts) {
    const c = Number(ciphertext);
    const bitsStr = attackBlock(B, c);
    
    if (!bitsStr) continue;

    for (let i = 0; i < bitsStr.length; i += 8) {
      const byte = bitsStr.slice(i, i + 8);
      if (byte.length === 8) {
        const charCode = parseInt(byte, 2);
        if (charCode >= 32 && charCode <= 126) {
          fullMessage += String.fromCharCode(charCode);
        }
      }
    }
  }
  return fullMessage;
}

function parseMessage(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

let lastProcessedId = 0;

function fetchNewMessages() {
  return new Promise((resolve) => {
    db.all(`
      SELECT m.id, m.ciphertext, m.sender_id, m.receiver_id, m.created_at,
             u1.username as from_username, u2.username as to_username,
             k.mh_public_key
      FROM messages m
      JOIN users u1 ON m.sender_id = u1.id
      JOIN users u2 ON m.receiver_id = u2.id
      LEFT JOIN user_keys k ON (m.sender_id = k.user_id OR m.receiver_id = k.user_id)
      WHERE m.id > ?
      ORDER BY m.id ASC
    `, lastProcessedId, (err, rows) => {
      resolve(rows || []);
    });
  });
}

async function crackNewMessages() {
  const rows = await fetchNewMessages();
  
  for (const row of rows) {
    const cipherObj = parseMessage(row.ciphertext);
    if (!cipherObj || !cipherObj.mh) continue;
    
    const mhCiphertexts = cipherObj.mh;
    const mhPub = parseMessage(row.mh_public_key);
    if (!mhPub) continue;
    
    console.log('\n' + '='.repeat(50));
    console.log('[!] INTERCEPTED #%d', row.id);
    console.log('    %s -> %s', row.from_username, row.to_username);
    console.log('    C: [%s...]', mhCiphertexts.slice(0, 3).join(','));
    
    const recovered = attackMessage(mhPub, mhCiphertexts);
    if (recovered) {
      console.log('[+] RECOVERED: "%s"', recovered);
    } else {
      console.log('[-] FAILED');
    }
    
    lastProcessedId = row.id;
  }
}

db.get('SELECT MAX(id) as max_id FROM messages', (err, row) => {
  console.log('==================================================');
  console.log('[*] CYBERCOM INTERCEPTOR');
  console.log('[*] Database: %s', dbPath);
  console.log('==================================================');
  
  lastProcessedId = row?.max_id || 0;
  console.log('[*] Crack ALL messages (ID > %d)\n', lastProcessedId);
  
  db.all('SELECT * FROM messages ORDER BY id ASC', async (err, allMsgs) => {
    if (allMsgs && allMsgs.length > 0) {
      for (const msg of allMsgs) {
        const cipherObj = parseMessage(msg.ciphertext);
        if (!cipherObj || !cipherObj.mh) continue;
        
        const mhCiphertexts = cipherObj.mh;
        
        const users = await new Promise((resolve) => {
          db.all("SELECT id, username FROM users WHERE id = ? OR id = ?", 
            [msg.sender_id, msg.receiver_id], (err, rows) => {
            if (err || !rows) {
              resolve({ sender: 'user' + msg.sender_id, receiver: 'user' + msg.receiver_id });
            } else {
              const senderName = rows.find(r => r.id === msg.sender_id)?.username || 'user' + msg.sender_id;
              const receiverName = rows.find(r => r.id === msg.receiver_id)?.username || 'user' + msg.receiver_id;
              resolve({ sender: senderName, receiver: receiverName });
            }
          });
        });
        
        const pubKey = await new Promise((resolve) => {
          db.get('SELECT mh_public_key FROM user_keys WHERE user_id = ?', 
            msg.receiver_id, (err, row) => {
            resolve(row ? parseMessage(row.mh_public_key) : null);
          });
        });
        
        if (!pubKey) continue;
        
        const recovered = attackMessage(pubKey, mhCiphertexts);
        console.log('[#%d] %s -> %s: "%s"', msg.id, users.sender, users.receiver, recovered || 'FAILED');
        lastProcessedId = msg.id;
      }
    }
    
    console.log('\n[*] Monitoring for NEW messages...\n');
    setInterval(crackNewMessages, 2000);
  });
});
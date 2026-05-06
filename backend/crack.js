const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// LLL Implementation
function dotProduct(v1, v2) {
  return v1.reduce((sum, val, i) => sum + val * v2[i], 0);
}

function vectorNorm(v) {
  return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
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
  const N = 100; // Weight for the last column

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

  let bestVector = null;

  for (const row of reduced) {
    if (row[n] !== 0) continue; // exact subset sum match required

    const v = row.slice(0, n);
    const isBinary = v.every(val => Math.abs(val - 1) < 0.1 || Math.abs(val) < 0.1);
    const isNegBinary = v.every(val => Math.abs(val + 1) < 0.1 || Math.abs(val) < 0.1);

    if (v.every(val => Math.abs(val) < 0.1)) continue;

    if (isBinary) {
      bestVector = v.map(Math.round);
      break;
    } else if (isNegBinary) {
      bestVector = v.map(val => Math.round(-val));
      break;
    }
  }

  if (bestVector === null) {
    return null;
  }

  const bits = bestVector.map(val => val === 1 ? '1' : '0');
  return bits.join('');
}

function attackMessage(publicKey, ciphertexts) {
  const B = publicKey.B.map(b => Number(b));
  let fullMessage = '';

  for (const ciphertext of ciphertexts) {
    const c = Number(ciphertext);
    const bitsStr = attackBlock(B, c);
    
    if (!bitsStr) {
      console.log("[-] Failed to decrypt block:", c);
      continue;
    }

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

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log("[*] Connecting to database to fetch intercepted messages...");

db.all(`
  SELECT m.id, m.ciphertext, u1.username as from_username, u2.username as to_username, k.mh_public_key
  FROM messages m
  JOIN users u1 ON m.sender_id = u1.id
  JOIN users u2 ON m.receiver_id = u2.id
  JOIN user_keys k ON m.receiver_id = k.user_id
  ORDER BY m.created_at DESC
`, (err, rows) => {
  if (err) {
    console.error("[-] Database error:", err);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log("[-] No messages found in the database. Send a message first!");
    process.exit(0);
  }

  console.log(`[+] Found ${rows.length} messages. Cracking the most recent one...\n`);

  const msg = rows[0];
  console.log(`[*] Intercepted transmission from ${msg.from_username} -> ${msg.to_username}`);
  
  const mhPublicKey = JSON.parse(msg.mh_public_key);
  const ciphertextObj = JSON.parse(msg.ciphertext);
  
  let mhCiphertexts;
  if (Array.isArray(ciphertextObj)) {
    mhCiphertexts = ciphertextObj;
  } else if (ciphertextObj.mh) {
    mhCiphertexts = ciphertextObj.mh;
  } else {
    console.error("[-] Invalid ciphertext format");
    process.exit(1);
  }

  console.log(`[*] Public Key (B): [${mhPublicKey.B.slice(0, 3).join(', ')}...]`);
  console.log(`[*] Ciphertext blocks: [${mhCiphertexts.slice(0, 3).join(', ')}...]`);
  console.log("[*] Executing LLL lattice reduction attack...");

  const startTime = Date.now();
  const recoveredText = attackMessage(mhPublicKey, mhCiphertexts);
  const endTime = Date.now();

  console.log(`\n[+] CRACK SUCCESSFUL (Time: ${endTime - startTime}ms)`);
  console.log(`[+] RECOVERED PLAINTEXT: "${recoveredText}"`);
});
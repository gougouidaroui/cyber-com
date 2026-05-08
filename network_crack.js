const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, 'captured_keys.json');

function clearKeys() {
  try { fs.unlinkSync(KEY_FILE); } catch {}
}

function loadKeys() {
  try {
    if (fs.existsSync(KEY_FILE)) {
      const data = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
      return new Map(Object.entries(data).map(([k, v]) => [parseInt(k), v]));
    }
  } catch {}
  return new Map();
}

function saveKeys(keys) {
  const obj = Object.fromEntries(keys);
  fs.writeFileSync(KEY_FILE, JSON.stringify(obj, null, 2));
}

clearKeys();
const knownKeys = loadKeys();

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
  const maxB = Math.max(...B);

  for (const nScale of [50, 100, 200, 500]) {
    const N = nScale * maxB;
    const matrixSize = n + 1;
    const matrix = [];

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
      if (Math.abs(row[n]) > 0.1) continue;

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

function parseLine(line) {
  const parts = line.split('\t');
  if (parts.length < 2) return;

  let uriStr = parts[0].trim();
  let bodyStr = parts.slice(1).join('\t').trim();

  if (/^[0-9a-fA-F]+$/.test(uriStr) && uriStr.length % 2 === 0) {
    uriStr = Buffer.from(uriStr, 'hex').toString('utf8');
  }
  if (/^[0-9a-fA-F]+$/.test(bodyStr) && bodyStr.length % 2 === 0) {
    bodyStr = Buffer.from(bodyStr, 'hex').toString('utf8');
  }

  const jsonMatch = bodyStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return;

  let payloadString = jsonMatch[0];
  if (payloadString.startsWith('"{')) {
    payloadString = JSON.parse(payloadString);
  }

  let payload;
  try {
    payload = JSON.parse(payloadString);
  } catch {
    return;
  }

  const storeKey = (uid, mhPub) => {
    const id = parseInt(uid);
    if (!knownKeys.has(id)) {
      console.log(`\n[+] CAPTURED Public Key for User ${id}`);
      knownKeys.set(id, mhPub);
      saveKeys(knownKeys);
      console.log(`[*] Keys stored: [${[...knownKeys.keys()].join(', ')}]`);
    }
  };

  if (uriStr.includes('/api/auth/login') && payload.user && payload.mhPublicKey) {
    storeKey(payload.user.id, payload.mhPublicKey);
    return;
  }

  if (uriStr.includes('/api/auth/register') && payload.user && payload.mhPublicKey) {
    storeKey(payload.user.id, payload.mhPublicKey);
    return;
  }

  if (payload.userId && payload.mhPublicKey) {
    storeKey(payload.userId, payload.mhPublicKey);
    return;
  }

  const keyMatch = uriStr.match(/\/api\/keys\/(\d+)/);
  if (keyMatch && payload.mhPublicKey) {
    storeKey(keyMatch[1], payload.mhPublicKey);
    return;
  }

  if (payload.receiverId && payload.ciphertext) {
    console.log('\n' + '='.repeat(50));
    console.log(`[!] INTERCEPTED MESSAGE to User ${payload.receiverId}`);

    const receiverId = parseInt(payload.receiverId);
    const pubKey = knownKeys.get(receiverId);

    let cipherObj;
    try {
      let ctStr = typeof payload.ciphertext === 'string' ? payload.ciphertext : JSON.stringify(payload.ciphertext);
      if (ctStr.startsWith('"{')) ctStr = JSON.parse(ctStr);
      cipherObj = JSON.parse(ctStr);
    } catch {
      console.log(`[-] Failed to parse ciphertext`);
      console.log('='.repeat(50));
      return;
    }

    if (!cipherObj || !cipherObj.mh) {
      console.log(`[-] Missing MH ciphertext`);
      console.log('='.repeat(50));
      return;
    }

    console.log(`    Ciphertext: [${cipherObj.mh.join(',')}...]`);
    console.log(`    Blocks: ${cipherObj.mh.length}`);

    if (!pubKey) {
      console.log(`[-] FAILED: Key for User ${receiverId} not captured.`);
      console.log(`[*] Keys in memory: [${[...knownKeys.keys()].join(', ')}]`);
      console.log('='.repeat(50));
      return;
    }

    console.log(`[*] Running LLL lattice reduction...`);
    const recovered = attackMessage(pubKey, cipherObj.mh);

    if (recovered) {
      console.log(`[+] CRACKED! "${recovered}"`);
    } else {
      console.log(`[-] LLL attack failed.`);
    }
    console.log('='.repeat(50));
  }
}

console.log('==================================================');
console.log('[*] CYBERCOM NETWORK INTERCEPTOR');
console.log('[*] Listening on lo:3000...');
console.log('==================================================');
console.log(`[*] Keys loaded: [${[...knownKeys.keys()].join(', ')}]`);
console.log('[*] Flow: Login -> Open chat with target -> Send msg\n');

const tshark = spawn('tshark', [
  '-i', 'lo',
  '-f', 'tcp port 3000',
  '-Y', 'http',
  '-T', 'fields',
  '-e', 'http.request.uri',
  '-e', 'http.file_data',
  '-l'
]);

tshark.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) parseLine(line);
  }
});

tshark.on('close', (code) => {
  console.log(`tshark exited (code ${code})`);
});
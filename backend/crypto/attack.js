const { lll } = require('./lll');

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

function lllWorking(matrix, delta = 0.75) {
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

    const reduced = lllWorking(matrix, 0.75);

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

function attack(publicKey, ciphertext) {
  const n = publicKey.n;
  const B = publicKey.B.map(b => Number(b));
  const c = Number(ciphertext);

  const bitsStr = attackBlock(B, c);

  if (!bitsStr) {
    return { success: false, message: 'Attack failed - no suitable vector found' };
  }

  let message = '';
  for (let i = 0; i < bitsStr.length; i += 8) {
    const byte = bitsStr.slice(i, i + 8);
    if (byte.length === 8) {
      const charCode = parseInt(byte, 2);
      if (charCode >= 32 && charCode <= 126) {
        message += String.fromCharCode(charCode);
      }
    }
  }

  return {
    success: true,
    message: message,
    rawBits: bitsStr,
    explanation: 'LLL lattice reduction was used to find the original plaintext vector from the public key and ciphertext'
  };
}

function attackOnBlocks(publicKey, ciphertexts) {
  const results = [];

  for (const ciphertext of ciphertexts) {
    const result = attack(publicKey, ciphertext);
    results.push(result);
  }

  let fullMessage = '';
  for (const result of results) {
    if (result.success) {
      fullMessage += result.message;
    }
  }

  return {
    success: fullMessage.length > 0,
    message: fullMessage,
    blockResults: results
  };
}

module.exports = { attack, attackOnBlocks };
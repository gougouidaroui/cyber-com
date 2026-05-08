function gcd(a, b) {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function modInverse(a, m) {
  let m0 = m;
  let y = 0;
  let x = 1;

  if (m === 1) return 0;

  while (a > 1) {
    const q = Math.floor(a / m);
    let t = m;
    m = a % m;
    a = t;
    t = y;
    y = x - q * y;
    x = t;
  }

  if (x < 0) x += m0;
  return x;
}

function generateSuperincreasingSequence(n) {
  const sequence = [];
  let sum = 0;

  for (let i = 0; i < n; i++) {
    const min = sum + 1;
    const max = sum * 2 + 1;
    const value = Math.floor(Math.random() * (max - min + 1)) + min;
    sequence.push(value);
    sum += value;
  }

  return sequence;
}

function mhGenerateKeyPair(blockSize = 8) {
  const W = generateSuperincreasingSequence(blockSize);
  const q = W.reduce((a, b) => a + b, 0) + Math.floor(Math.random() * 100) + 1;

  let r;
  do {
    r = Math.floor(Math.random() * (q - 2)) + 2;
  } while (gcd(r, q) !== 1);

  const rInverse = modInverse(r, q);

  const B = W.map(wi => (r * wi) % q);

  return {
    publicKey: {
      B: B,
      n: blockSize
    },
    privateKey: {
      W: W,
      q: q,
      r: r,
      rInverse: rInverse,
      n: blockSize
    }
  };
}

function messageToBlocks(message, blockSize) {
  const binaryString = [];
  for (let i = 0; i < message.length; i++) {
    const binary = message.charCodeAt(i).toString(2).padStart(8, '0');
    binaryString.push(binary);
  }

  const blocks = [];
  const combinedBinary = binaryString.join('');

  for (let i = 0; i < combinedBinary.length; i += blockSize) {
    const block = combinedBinary.slice(i, i + blockSize);
    if (block.length < blockSize) {
      blocks.push(block.padStart(blockSize, '0'));
    } else {
      blocks.push(block);
    }
  }

  return blocks;
}

function blocksToMessage(blocks) {
  const binaryString = blocks.join('');
  let message = '';

  for (let i = 0; i < binaryString.length; i += 8) {
    const byte = binaryString.slice(i, i + 8);
    if (byte.length === 8) {
      const charCode = parseInt(byte, 2);
      if (charCode !== 0) {
        message += String.fromCharCode(charCode);
      }
    }
  }

  return message;
}

function mhEncrypt(message, publicKey) {
  const blocks = messageToBlocks(message, publicKey.n);

  const ciphertexts = blocks.map(block => {
    let sum = 0n;
    for (let i = 0; i < block.length; i++) {
      if (block[i] === '1') {
        sum += BigInt(publicKey.B[i]);
      }
    }
    return sum.toString();
  });

  return ciphertexts;
}

function mhDecrypt(ciphertexts, privateKey) {
  const { W, q, rInverse, n } = privateKey;

  const blocks = ciphertexts.map(ciphertext => {
    const c = BigInt(ciphertext);
    const cPrime = (c * BigInt(rInverse)) % BigInt(q);

    let remaining = cPrime;
    const bits = [];

    for (let i = W.length - 1; i >= 0; i--) {
      if (remaining >= BigInt(W[i])) {
        bits.unshift('1');
        remaining -= BigInt(W[i]);
      } else {
        bits.unshift('0');
      }
    }

    return bits.join('');
  });

  return blocksToMessage(blocks);
}

function isProbablePrime(n, iterations = 5) {
  const nBig = BigInt(n);
  if (nBig < 2n) return false;
  if (nBig === 2n || nBig === 3n) return true;
  if (nBig % 2n === 0n) return false;

  let s = nBig - 1n;
  let t = 0;
  while (s % 2n === 0n) {
    s /= 2n;
    t++;
  }

  for (let i = 0; i < iterations; i++) {
    const a = BigInt(Math.floor(Math.random() * (n - 4)) + 2);
    let x = modPow(a, s, nBig);

    if (x === 1n || x === nBig - 1n) continue;

    let isComposite = true;
    for (let j = 0; j < t - 1; j++) {
      x = (x * x) % nBig;
      if (x === nBig - 1n) {
        isComposite = false;
        break;
      }
    }

    if (isComposite) return false;
  }

  return true;
}

function modPow(base, exponent, mod) {
  let result = 1n;
  let b = BigInt(base);
  let e = BigInt(exponent);
  const m = BigInt(mod);

  while (e > 0n) {
    if (e % 2n === 1n) {
      result = (result * b) % m;
    }
    b = (b * b) % m;
    e /= 2n;
  }

  return result;
}

function gcdExtended(a, b) {
  if (a === 0n) return [b, 0n, 1n];
  const [gcd, x1, y1] = gcdExtended(b % a, a);
  const x = y1 - (b / a) * x1;
  const y = x1;
  return [gcd, x, y];
}

function egModInverse(a, m) {
  const [gcd, x] = gcdExtended(a, m);
  if (gcd !== 1n) return null;
  return ((x % m) + m) % m;
}

function egEncryptBigInt(messageNum, publicKey) {
  const { p: pStr, g: gStr, A: AStr } = publicKey;
  const p = BigInt(pStr);
  const g = BigInt(gStr);
  const A = BigInt(AStr);

  const k = BigInt(Math.floor(Math.random() * Number(p - 2n))) + 1n;

  const c1 = modPow(g, k, p);
  const s = modPow(A, k, p);
  const c2 = (BigInt(messageNum) * s) % p;

  return {
    c1: c1.toString(),
    c2: c2.toString()
  };
}

function egDecryptBigInt(ciphertext, privateKey) {
  const { p: pStr, a: aStr } = privateKey;
  const p = BigInt(pStr);
  const a = BigInt(aStr);

  const c1 = BigInt(ciphertext.c1);
  const c2 = BigInt(ciphertext.c2);

  const s = modPow(c1, a, p);
  const sInverse = egModInverse(s, p);

  if (sInverse === null) return null;

  const m = (c2 * sInverse) % p;

  return m.toString();
}

export function encryptMessage(message, receiverPublicKey) {
  const mhCiphertexts = mhEncrypt(message, receiverPublicKey.mh);

  const egCiphertexts = mhCiphertexts.map(ct => {
    return egEncryptBigInt(ct, receiverPublicKey.eg);
  });

  return JSON.stringify({
    mh: mhCiphertexts,
    eg: egCiphertexts
  });
}

export function decryptMessage(ciphertext, privateKey) {
  const ciphertextObj = JSON.parse(ciphertext);
  const mhCiphertexts = ciphertextObj.mh;
  const egCiphertexts = ciphertextObj.eg;

  const mhDecrypted = egCiphertexts.map(egCt => {
    return egDecryptBigInt(egCt, privateKey.eg);
  });

  return mhDecrypt(mhDecrypted, privateKey.mh);
}


function isProbablePrime(n, iterations = 5) {
  const nBig = BigInt(n);
  if (nBig < 2n) return false;
  if (nBig === 2n || nBig === 3n) return true;
  if (nBig % 2n === 0n) return false;

  let s = nBig - 1n;
  let t = 0;
  while (s % 2n === 0n) {
    t++;
    s /= 2n;
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

function modInverse(a, m) {
  const [gcd, x] = gcdExtended(a, m);
  if (gcd !== 1n) return null;
  return ((x % m) + m) % m;
}

function generatePrime(bits) {
  let prime;
  do {
    prime = BigInt(0);
    for (let i = 0; i < bits; i++) {
      prime = (prime << 1n) | BigInt(Math.random() < 0.5 ? 1 : 0);
    }
    prime |= 1n;
  } while (!isProbablePrime(Number(prime)));
  return prime;
}

function findGenerator(p) {
  const pMinus1 = p - 1n;
  const factors = [];

  let n = pMinus1;
  let d = 2n;
  while (d * d <= n) {
    if (n % d === 0n) {
      factors.push(d);
      while (n % d === 0n) n /= d;
    }
    d++;
  }
  if (n > 1n) factors.push(n);

  for (let g = 2n; g < p - 1n; g++) {
    let isGenerator = true;
    for (const factor of factors) {
      if (modPow(g, pMinus1 / factor, p) === 1n) {
        isGenerator = false;
        break;
      }
    }
    if (isGenerator) return g;
  }

  return 2n;
}

function generateKeyPair(keySize = 16) {
  const p = generatePrime(keySize);
  const g = findGenerator(p);

  const a = BigInt(Math.floor(Math.random() * Number(p - 2n))) + 2n;
  const A = modPow(g, a, p);

  return {
    publicKey: {
      p: p.toString(),
      g: g.toString(),
      A: A.toString()
    },
    privateKey: {
      p: p.toString(),
      g: g.toString(),
      a: a.toString()
    }
  };
}

function encrypt(message, publicKey) {
  const { p: pStr, g: gStr, A: AStr } = publicKey;
  const p = BigInt(pStr);
  const g = BigInt(gStr);
  const A = BigInt(AStr);

  const m = BigInt(message.charCodeAt(0));

  const k = BigInt(Math.floor(Math.random() * Number(p - 2n))) + 1n;

  const c1 = modPow(g, k, p);
  const s = modPow(A, k, p);
  const c2 = (m * s) % p;

  return {
    c1: c1.toString(),
    c2: c2.toString()
  };
}

function encryptMessage(message, publicKey) {
  const { p: pStr, g: gStr, A: AStr } = publicKey;
  const p = BigInt(pStr);
  const g = BigInt(gStr);
  const A = BigInt(AStr);

  const ciphertexts = [];

  for (let i = 0; i < message.length; i++) {
    const m = BigInt(message.charCodeAt(i));

    const k = BigInt(Math.floor(Math.random() * Number(p - 2n))) + 1n;

    const c1 = modPow(g, k, p);
    const s = modPow(A, k, p);
    const c2 = (m * s) % p;

    ciphertexts.push({
      c1: c1.toString(),
      c2: c2.toString()
    });
  }

  return ciphertexts;
}

function decrypt(ciphertext, privateKey) {
  const { p: pStr, a: aStr } = privateKey;
  const p = BigInt(pStr);
  const a = BigInt(aStr);

  const c1 = BigInt(ciphertext.c1);
  const c2 = BigInt(ciphertext.c2);

  const s = modPow(c1, a, p);
  const sInverse = modInverse(s, p);

  if (sInverse === null) return null;

  const m = (c2 * sInverse) % p;

  return String.fromCharCode(Number(m));
}

function decryptMessage(ciphertexts, privateKey) {
  const { p: pStr, a: aStr } = privateKey;
  const p = BigInt(pStr);
  const a = BigInt(aStr);

  let message = '';

  for (const { c1, c2 } of ciphertexts) {
    const c1Big = BigInt(c1);
    const c2Big = BigInt(c2);

    const s = modPow(c1Big, a, p);
    const sInverse = modInverse(s, p);

    if (sInverse === null) continue;

    const m = (c2Big * sInverse) % p;
    message += String.fromCharCode(Number(m));
  }

  return message;
}

function encryptBigInt(messageNum, publicKey) {
  const { p: pStr, g: gStr, A: AStr } = publicKey;
  const p = BigInt(pStr);
  const g = BigInt(gStr);
  const A = BigInt(AStr);

  const k = BigInt(Math.floor(Math.random() * Number(p - 2n))) + 1n;

  const c1 = modPow(g, k, p);
  const s = modPow(A, k, p);
  const c2 = (messageNum * s) % p;

  return {
    c1: c1.toString(),
    c2: c2.toString()
  };
}

function decryptBigInt(ciphertext, privateKey) {
  const { p: pStr, a: aStr } = privateKey;
  const p = BigInt(pStr);
  const a = BigInt(aStr);

  const c1 = BigInt(ciphertext.c1);
  const c2 = BigInt(ciphertext.c2);

  const s = modPow(c1, a, p);
  const sInverse = modInverse(s, p);

  if (sInverse === null) return null;

  const m = (c2 * sInverse) % p;

  return m.toString();
}

module.exports = {
  generateKeyPair,
  encrypt,
  decrypt,
  encryptMessage,
  decryptMessage,
  encryptBigInt,
  decryptBigInt,
  modPow
};

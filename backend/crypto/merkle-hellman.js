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

function generateKeyPair(blockSize = 8) {
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

function encrypt(message, publicKey) {
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

function decrypt(ciphertexts, privateKey) {
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

module.exports = {
  generateKeyPair,
  encrypt,
  decrypt,
  messageToBlocks,
  blocksToMessage
};
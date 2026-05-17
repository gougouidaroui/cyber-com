import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Terminal, KeyRound, LogOut, Shield, 
  Play, Activity, FileText, Lock, Clock, Database
} from 'lucide-react';

const gcd = (a, b) => {
  while (b !== 0) { const t = b; b = a % b; a = t; }
  return a;
};

const modInverse = (a, m) => {
  let m0 = m, y = 0, x = 1;
  if (m === 1) return 0;
  while (a > 1) {
    const q = Math.floor(a / m);
    let t = m; m = a % m; a = t;
    t = y; y = x - q * y; x = t;
  }
  if (x < 0) x += m0;
  return x;
};

const generateSuperincreasingSequence = (n) => {
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
};

const mhGenerateKeyPair = (blockSize = 8) => {
  const W = generateSuperincreasingSequence(blockSize);
  const q = W.reduce((a, b) => a + b, 0) + Math.floor(Math.random() * 100) + 1;
  let r;
  do { r = Math.floor(Math.random() * (q - 2)) + 2; } while (gcd(r, q) !== 1);
  const rInverse = modInverse(r, q);
  const B = W.map(wi => (r * wi) % q);
  return {
    publicKey: { B, n: blockSize },
    privateKey: { W, q, r, rInverse, n: blockSize }
  };
};

const messageToBlocks = (message, blockSize) => {
  const binaryString = [];
  for (let i = 0; i < message.length; i++) {
    binaryString.push(message.charCodeAt(i).toString(2).padStart(8, '0'));
  }
  const blocks = [];
  const combinedBinary = binaryString.join('');
  for (let i = 0; i < combinedBinary.length; i += blockSize) {
    const block = combinedBinary.slice(i, i + blockSize);
    blocks.push(block.length < blockSize ? block.padStart(blockSize, '0') : block);
  }
  return blocks;
};

const mhEncrypt = (message, publicKey) => {
  const blocks = messageToBlocks(message, publicKey.n);
  return blocks.map(block => {
    let sum = 0n;
    for (let i = 0; i < block.length; i++) {
      if (block[i] === '1') sum += BigInt(publicKey.B[i]);
    }
    return sum.toString();
  });
};

const mhDecrypt = (ciphertexts, privateKey) => {
  const { W, q, rInverse } = privateKey;
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
  const binaryString = blocks.join('');
  let message = '';
  for (let i = 0; i < binaryString.length; i += 8) {
    const byte = binaryString.slice(i, i + 8);
    if (byte.length === 8) {
      const charCode = parseInt(byte, 2);
      if (charCode !== 0) message += String.fromCharCode(charCode);
    }
  }
  return message;
};

const isProbablePrime = (n, iterations = 5) => {
  const nBig = BigInt(n);
  if (nBig < 2n) return false;
  if (nBig === 2n || nBig === 3n) return true;
  if (nBig % 2n === 0n) return false;
  let s = nBig - 1n, t = 0;
  while (s % 2n === 0n) { s /= 2n; t++; }
  for (let i = 0; i < iterations; i++) {
    const a = BigInt(Math.floor(Math.random() * (n - 4)) + 2);
    let x = modPow(a, s, nBig);
    if (x === 1n || x === nBig - 1n) continue;
    let isComposite = true;
    for (let j = 0; j < t - 1; j++) {
      x = (x * x) % nBig;
      if (x === nBig - 1n) { isComposite = false; break; }
    }
    if (isComposite) return false;
  }
  return true;
};

const modPow = (base, exponent, mod) => {
  let result = 1n, b = BigInt(base), e = BigInt(exponent), m = BigInt(mod);
  while (e > 0n) {
    if (e % 2n === 1n) result = (result * b) % m;
    b = (b * b) % m;
    e /= 2n;
  }
  return result;
};

const generatePrime = (bits) => {
  let prime;
  do {
    prime = 0n;
    for (let i = 0; i < bits; i++) {
      prime = (prime << 1n) | BigInt(Math.random() < 0.5 ? 1 : 0);
    }
    prime |= 1n;
  } while (!isProbablePrime(Number(prime)));
  return prime;
};

const findGenerator = (p) => {
  const pMinus1 = p - 1n;
  const factors = [];
  let n = pMinus1, d = 2n;
  while (d * d <= n) {
    if (n % d === 0n) { factors.push(d); while (n % d === 0n) n /= d; }
    d++;
  }
  if (n > 1n) factors.push(n);
  for (let g = 2n; g < p - 1n; g++) {
    let isGenerator = true;
    for (const factor of factors) {
      if (modPow(g, pMinus1 / factor, p) === 1n) { isGenerator = false; break; }
    }
    if (isGenerator) return g;
  }
  return 2n;
};

const egGenerateKeyPair = (keySize = 16) => {
  const p = generatePrime(keySize);
  const g = findGenerator(p);
  const a = BigInt(Math.floor(Math.random() * Number(p - 2n))) + 2n;
  const A = modPow(g, a, p);
  return {
    publicKey: { p: p.toString(), g: g.toString(), A: A.toString() },
    privateKey: { p: p.toString(), g: g.toString(), a: a.toString() }
  };
};

const egEncrypt = (message, publicKey) => {
  const { p: pStr, g: gStr, A: AStr } = publicKey;
  const p = BigInt(pStr), g = BigInt(gStr), A = BigInt(AStr);
  const ciphertexts = [];
  for (let i = 0; i < message.length; i++) {
    const m = BigInt(message.charCodeAt(i));
    const k = BigInt(Math.floor(Math.random() * Number(p - 2n))) + 1n;
    const c1 = modPow(g, k, p);
    const s = modPow(A, k, p);
    const c2 = (m * s) % p;
    ciphertexts.push({ c1: c1.toString(), c2: c2.toString() });
  }
  return ciphertexts;
};

const egDecrypt = (ciphertexts, privateKey) => {
  const { p: pStr, a: aStr } = privateKey;
  const p = BigInt(pStr), a = BigInt(aStr);
  let message = '';
  for (const c of ciphertexts) {
    const c1 = BigInt(c.c1), c2 = BigInt(c.c2);
    const s = modPow(c1, a, p);
    const sInverse = modInverseBig(s, p);
    if (sInverse) message += String.fromCharCode(Number((c2 * sInverse) % p));
  }
  return message;
};

const gcdExtended = (a, b) => {
  if (a === 0n) return [b, 0n, 1n];
  const [gcd, x1, y1] = gcdExtended(b % a, a);
  return [gcd, y1 - (b / a) * x1, x1];
};

const modInverseBig = (a, m) => {
  const [gcd, x] = gcdExtended(a, m);
  if (gcd !== 1n) return null;
  return ((x % m) + m) % m;
};

export default function Compare() {
  const [benchmarking, setBenchmarking] = useState(false);
  const [results, setResults] = useState(null);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const runBenchmarks = async () => {
    setBenchmarking(true);
    const iterations = 10;
    const testMessage = 'Hello World';
    
    const mhKeyGenTimes = [];
    const mhEncryptTimes = [];
    const mhDecryptTimes = [];
    const egKeyGenTimes = [];
    const egEncryptTimes = [];
    const egDecryptTimes = [];

    for (let i = 0; i < iterations; i++) {
      const t1 = performance.now();
      const mhKeys = mhGenerateKeyPair(8);
      mhKeyGenTimes.push(performance.now() - t1);

      const t2 = performance.now();
      const mhCt = mhEncrypt(testMessage, mhKeys.publicKey);
      mhEncryptTimes.push(performance.now() - t2);

      const t3 = performance.now();
      mhDecrypt(mhCt, mhKeys.privateKey);
      mhDecryptTimes.push(performance.now() - t3);

      const t4 = performance.now();
      const egKeys = egGenerateKeyPair(16);
      egKeyGenTimes.push(performance.now() - t4);

      const t5 = performance.now();
      const egCt = egEncrypt(testMessage, egKeys.publicKey);
      egEncryptTimes.push(performance.now() - t5);

      const t6 = performance.now();
      egDecrypt(egCt, egKeys.privateKey);
      egDecryptTimes.push(performance.now() - t6);
    }

    const avg = arr => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);

    const mhKeys = mhGenerateKeyPair(8);
    const egKeys = egGenerateKeyPair(16);

    const mhPubKeySize = JSON.stringify(mhKeys.publicKey).length * 8;
    const mhPrivKeySize = JSON.stringify(mhKeys.privateKey).length * 8;
    const egPubKeySize = JSON.stringify(egKeys.publicKey).length * 8;
    const egPrivKeySize = JSON.stringify(egKeys.privateKey).length * 8;

    const mhCt = mhEncrypt(testMessage, mhKeys.publicKey);
    const egCt = egEncrypt(testMessage, egKeys.publicKey);
    const plaintextSize = new Blob([testMessage]).size;
    const mhCiphertextSize = new Blob([JSON.stringify(mhCt)]).size;
    const egCiphertextSize = new Blob([JSON.stringify(egCt)]).size;

    setResults({
      keyGen: { mh: avg(mhKeyGenTimes), eg: avg(egKeyGenTimes) },
      encrypt: { mh: avg(mhEncryptTimes), eg: avg(egEncryptTimes) },
      decrypt: { mh: avg(mhDecryptTimes), eg: avg(egDecryptTimes) },
      keySizes: {
        mhPublic: mhPubKeySize,
        mhPrivate: mhPrivKeySize,
        egPublic: egPubKeySize,
        egPrivate: egPrivKeySize
      },
      overhead: {
        plaintext: plaintextSize,
        mhCiphertext: mhCiphertextSize,
        egCiphertext: egCiphertextSize,
        mhRatio: (mhCiphertextSize / plaintextSize).toFixed(1),
        egRatio: (egCiphertextSize / plaintextSize).toFixed(1)
      }
    });
    setBenchmarking(false);
  };

  return (
    <div className="compare-container">
      <header className="chat-header">
        <h1><Activity size={20} /> COMPARISON REPORT</h1>
        <div className="header-actions">
          <span className="header-user">SUBJ: {user?.username}</span>
          <nav>
            <Link to="/chats" className="header-link"><Terminal size={14} /> CHANNELS</Link>
            <Link to="/keys" className="header-link"><KeyRound size={14} /> KEYS</Link>
            <Link to="/playground" className="header-link"><Play size={14} /> PLAYGROUND</Link>
            <button onClick={() => { logout(); navigate('/'); }} className="secondary">
              <LogOut size={14} /> LOGOUT
            </button>
          </nav>
        </div>
      </header>

      <main className="main-wrapper">
        <section className="terminal-section" style={{ borderTopColor: 'var(--color-primary)' }}>
          <h2 style={{ color: 'var(--color-primary)' }}><Clock size={16} /> BENCHMARKS</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
            Running {results ? '10' : '10'} iterations per operation...
          </p>
          <button 
            className="primary" 
            onClick={runBenchmarks} 
            disabled={benchmarking}
            style={{ width: 'auto', marginBottom: '20px' }}
          >
            {benchmarking ? <Clock size={16} /> : <Activity size={16} />}
            {benchmarking ? ' BENCHMARKING...' : ' RUN BENCHMARKS'}
          </button>

          {results && (
            <div className="comparison-grid">
              <div className="compare-card">
                <h3>KEY GENERATION (ms)</h3>
                <div className="compare-row">
                  <span>Merkle-Hellman:</span>
                  <code>{results.keyGen.mh} ms</code>
                </div>
                <div className="compare-row">
                  <span>ElGamal:</span>
                  <code>{results.keyGen.eg} ms</code>
                </div>
              </div>
              <div className="compare-card">
                <h3>ENCRYPTION (ms)</h3>
                <div className="compare-row">
                  <span>Merkle-Hellman:</span>
                  <code>{results.encrypt.mh} ms</code>
                </div>
                <div className="compare-row">
                  <span>ElGamal:</span>
                  <code>{results.encrypt.eg} ms</code>
                </div>
              </div>
              <div className="compare-card">
                <h3>DECRYPTION (ms)</h3>
                <div className="compare-row">
                  <span>Merkle-Hellman:</span>
                  <code>{results.decrypt.mh} ms</code>
                </div>
                <div className="compare-row">
                  <span>ElGamal:</span>
                  <code>{results.decrypt.eg} ms</code>
                </div>
              </div>
            </div>
          )}
        </section>

        {results && (
          <>
            <section className="terminal-section">
              <h2><Database size={16} /> KEY SIZES (BITS)</h2>
              <div className="comparison-grid">
                <div className="compare-card">
                  <h3>MERKLE-HELLMAN</h3>
                  <div className="compare-row">
                    <span>Public Key (B):</span>
                    <code>{results.keySizes.mhPublic} bits</code>
                  </div>
                  <div className="compare-row">
                    <span>Private Key (W,q,r):</span>
                    <code>{results.keySizes.mhPrivate} bits</code>
                  </div>
                </div>
                <div className="compare-card">
                  <h3>ELGAMAL</h3>
                  <div className="compare-row">
                    <span>Public Key (p,g,A):</span>
                    <code>{results.keySizes.egPublic} bits</code>
                  </div>
                  <div className="compare-row">
                    <span>Private Key (a):</span>
                    <code>{results.keySizes.egPrivate} bits</code>
                  </div>
                </div>
              </div>
            </section>

            <section className="terminal-section">
              <h2><FileText size={16} /> CIPHERTEXT OVERHEAD</h2>
              <div className="overhead-table">
                <div className="compare-card">
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Plaintext</th>
                        <th>MH Cipher</th>
                        <th>EG Cipher</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Size (bytes)</td>
                        <td>{results.overhead.plaintext}</td>
                        <td>{results.overhead.mhCiphertext}</td>
                        <td>{results.overhead.egCiphertext}</td>
                      </tr>
                      <tr>
                        <td>Overhead Ratio</td>
                        <td>1x (baseline)</td>
                        <td>{results.overhead.mhRatio}x</td>
                        <td>{results.overhead.egRatio}x</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}

        <section className="terminal-section" style={{ borderTopColor: 'var(--color-destructive)' }}>
          <h2 style={{ color: 'var(--color-destructive)' }}><Shield size={16} /> SECURITY ANALYSIS</h2>
          
          <div className="security-cards">
            <div className="security-card mh">
              <h3>MERKLE-HELLMAN</h3>
              <div className="security-section">
                <h4>Encryption Type</h4>
                <p>Knapsack / Subset Sum</p>
              </div>
              <div className="security-section">
                <h4>Vulnerabilities</h4>
                <ul>
                  <li>[!] <strong>VULNERABLE</strong> to Shamir's LLL attack</li>
                  <li>LLL reduces lattice to recover private key</li>
                  <li>Broken in polynomial time</li>
                </ul>
              </div>
              <div className="security-section">
                <h4>Security Level</h4>
                <span className="badge dangerous">COMPROMISED</span>
              </div>
            </div>

            <div className="security-card eg">
              <h3>ELGAMAL</h3>
              <div className="security-section">
                <h4>Encryption Type</h4>
                <p>Diffie-Hellman (Discrete Log)</p>
              </div>
              <div className="security-section">
                <h4>Vulnerabilities</h4>
                <ul>
                  <li>[+] <strong>SECURE</strong> against known attacks</li>
                  <li>Based on discrete logarithm problem</li>
                  <li>No efficient sub-exponential attack known</li>
                </ul>
              </div>
              <div className="security-section">
                <h4>Security Level</h4>
                <span className="badge secure">RECOMMENDED</span>
              </div>
            </div>
          </div>
        </section>

        <section className="terminal-section">
          <h2><Lock size={16} /> CONCLUSION</h2>
          <div className="terminal-display" style={{ borderColor: 'var(--color-accent)' }}>
            <p style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>RECOMMENDATION: Use Hybrid Approach</p>
            <p>This app uses <strong>Merkle-Hellman + ElGamal combined</strong>:</p>
            <ul style={{ color: 'rgba(255,255,255,0.8)', marginTop: '12px' }}>
              <li>1. Message encrypted with Merkle-Hellman</li>
              <li>2. MH ciphertext then encrypted with ElGamal</li>
              <li>3. Provides defense-in-depth: even if MH is broken, EG still protects</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
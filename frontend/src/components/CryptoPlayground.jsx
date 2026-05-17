import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/api';
import { 
  Terminal, KeyRound, LogOut, Activity,
  ChevronDown, ChevronRight, Play, RotateCcw, Lock, Unlock
} from 'lucide-react';

const gcd = (a, b) => {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
};

const modInverse = (a, m) => {
  let m0 = m, y = 0, x = 1;
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
  do {
    r = Math.floor(Math.random() * (q - 2)) + 2;
  } while (gcd(r, q) !== 1);
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

const mhEncryptStep = (message, publicKey) => {
  const blocks = messageToBlocks(message, publicKey.n);
  const steps = [];
  
  steps.push({
    title: '1. Original Message',
    content: `"${message}" (${message.length} characters)`
  });
  
  steps.push({
    title: '2. Binary Conversion',
    content: blocks.map((block, i) => {
      const char = message[Math.floor(i * publicKey.n / 8)] || '';
      return `${char || '?'}: ${block}`;
    }).join('\n')
  });
  
  steps.push({
    title: '3. Block Partitioning',
    content: blocks.map((b, i) => `Block ${i + 1}: ${b}`).join('\n')
  });
  
  steps.push({
    title: '4. Public Key (B vector)',
    content: `[${publicKey.B.join(', ')}]`
  });
  
  const encrypted = blocks.map((block) => {
    const contributions = [];
    let sum = 0n;
    for (let i = 0; i < block.length; i++) {
      if (block[i] === '1') {
        contributions.push(`B[${i}]=${publicKey.B[i]}`);
        sum += BigInt(publicKey.B[i]);
      }
    }
    return { block, contributions, sum: sum.toString() };
  });
  
  steps.push({
    title: '5. Encryption (Σ B[i] for bits=1)',
    content: encrypted.map((e, i) => 
      `Block ${i + 1}: ${e.contributions.join(' + ')} = ${e.sum}`
    ).join('\n')
  });
  
  steps.push({
    title: '6. Final Ciphertext',
    content: `[${encrypted.map(e => e.sum).join(', ')}]`
  });
  
  return { steps, ciphertext: encrypted.map(e => e.sum) };
};

const mhDecryptStep = (ciphertexts, privateKey) => {
  const { W, q, rInverse } = privateKey;
  const steps = [];
  
  steps.push({
    title: '1. Ciphertext Array',
    content: `[${ciphertexts.join(', ')}]`
  });
  
  steps.push({
    title: '2. Parameters',
    content: `q = ${q}, r⁻¹ = ${rInverse}`
  });
  
  const decrypted = ciphertexts.map((c, idx) => {
    const cBig = BigInt(c);
    const cPrime = (cBig * BigInt(rInverse)) % BigInt(q);
    
    let remaining = cPrime;
    const bits = [];
    const trace = [];
    
    for (let i = W.length - 1; i >= 0; i--) {
      if (remaining >= BigInt(W[i])) {
        bits.unshift('1');
        trace.push(`W[${i}]=${W[i]} ≤ ${remaining} → 1, remaining -= ${W[i]}`);
        remaining -= BigInt(W[i]);
      } else {
        bits.unshift('0');
        trace.push(`W[${i}]=${W[i]} > ${remaining} → 0`);
      }
    }
    
    return { idx, cPrime: cPrime.toString(), trace, bits: bits.join('') };
  });
  
  steps.push({
    title: '3. Decryption Process',
    content: decrypted.map(d => 
      `Cipher ${d.idx + 1}: c'=${d.cPrime}\n${d.trace.join('\n')}`
    ).join('\n\n')
  });
  
  const binaryString = decrypted.map(d => d.bits).join('');
  let message = '';
  for (let i = 0; i < binaryString.length; i += 8) {
    const byte = binaryString.slice(i, i + 8);
    if (byte.length === 8) {
      const charCode = parseInt(byte, 2);
      if (charCode !== 0) message += String.fromCharCode(charCode);
    }
  }
  
  steps.push({
    title: '4. Binary to Text',
    content: `Binary: ${binaryString}\nMessage: "${message}"`
  });
  
  return { steps, message };
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

const gcdExtended = (a, b) => {
  if (a === 0n) return [b, 0n, 1n];
  const [gcd, x1, y1] = gcdExtended(b % a, a);
  return [gcd, y1 - (b / a) * x1, x1];
};

const egModInverse = (a, m) => {
  const [gcd, x] = gcdExtended(a, m);
  if (gcd !== 1n) return null;
  return ((x % m) + m) % m;
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
      if (modPow(g, pMinus1 / factor, p) === 1n) { isGenerator = false; break; }
    }
    if (isGenerator) return g;
  }
  return 2n;
};

const egEncryptStep = (message, publicKey) => {
  const { p: pStr, g: gStr, A: AStr } = publicKey;
  const p = BigInt(pStr), g = BigInt(gStr), A = BigInt(AStr);
  const steps = [];
  
  steps.push({
    title: '1. Original Message',
    content: `"${message}" (${message.length} characters)`
  });
  
  steps.push({
    title: '2. Public Parameters',
    content: `p = ${pStr}\ng = ${gStr}\nA = ${AStr}`
  });
  
  const encrypted = [];
  for (let i = 0; i < message.length; i++) {
    const m = BigInt(message.charCodeAt(i));
    const k = BigInt(Math.floor(Math.random() * Number(p - 2n))) + 1n;
    const c1 = modPow(g, k, p);
    const s = modPow(A, k, p);
    const c2 = (m * s) % p;
    encrypted.push({ char: message[i], m: m.toString(), k: k.toString(), c1: c1.toString(), s: s.toString(), c2: c2.toString() });
  }
  
  steps.push({
    title: '3. Per-Character Encryption',
    content: encrypted.map((e) => 
      `Char "${e.char}" (m=${e.m}):\nk=${e.k}\nc1=g^k mod p=${e.c1}\ns=A^k mod p=${e.s}\nc2=m·s mod p=${e.c2}`
    ).join('\n\n')
  });
  
  steps.push({
    title: '4. Final Ciphertext Pairs',
    content: encrypted.map((e) => 
      `[c1=${e.c1}, c2=${e.c2}]`
    ).join('\n')
  });
  
  return { steps, ciphertext: encrypted.map(e => ({ c1: e.c1, c2: e.c2 })) };
};

const egDecryptStep = (ciphertexts, privateKey) => {
  const { p: pStr, a: aStr } = privateKey;
  const p = BigInt(pStr), a = BigInt(aStr);
  const steps = [];
  
  steps.push({
    title: '1. Ciphertext Pairs',
    content: ciphertexts.map((c, i) => 
      `Char ${i + 1}: [c1=${c.c1}, c2=${c.c2}]`
    ).join('\n')
  });
  
  steps.push({
    title: '2. Private Key',
    content: `a = ${aStr}`
  });
  
  const decrypted = ciphertexts.map((c, idx) => {
    const c1 = BigInt(c.c1), c2 = BigInt(c.c2);
    const s = modPow(c1, a, p);
    const sInverse = egModInverse(s, p);
    const m = sInverse ? (c2 * sInverse) % p : 0n;
    return { idx, s: s.toString(), sInverse: sInverse?.toString() || 'N/A', m: m.toString(), char: String.fromCharCode(Number(m)) };
  });
  
  steps.push({
    title: '3. Decryption Process',
    content: decrypted.map(d => 
      `Char ${d.idx + 1}:\ns = c1^a mod p = ${d.s}\ns⁻¹ = ${d.sInverse}\nm = c2 · s⁻¹ mod p = ${d.m}\n→ "${d.char}"`
    ).join('\n\n')
  });
  
  const message = decrypted.map(d => d.char).join('');
  steps.push({
    title: '4. Final Message',
    content: `"${message}"`
  });
  
  return { steps, message };
};

export default function CryptoPlayground() {
  const [algorithm, setAlgorithm] = useState('mh');
  const [keySource, setKeySource] = useState('demo');
  const [message, setMessage] = useState('Hi');
  const [userKeys, setUserKeys] = useState(null);
  const [result, setResult] = useState(null);
  const [decryptResult, setDecryptResult] = useState(null);
  const [expandedSteps, setExpandedSteps] = useState({});
  const [mode, setMode] = useState('encrypt');
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const demoKeys = useMemo(() => {
    if (keySource !== 'demo') return null;
    return algorithm === 'mh' ? mhGenerateKeyPair(8) : egGenerateKeyPair(16);
  }, [algorithm, keySource]);

  useEffect(() => {
    const fetchUserKeys = async () => {
      if (keySource === 'mine' && user?.id) {
        try {
          const k = await api.keys.getUserKeys(user.id);
          setUserKeys(k);
        } catch (err) {
          console.error('Failed to fetch keys:', err);
        }
      }
    };
    fetchUserKeys();
  }, [keySource, user?.id]);

  const activeKeys = keySource === 'demo' ? demoKeys : userKeys;

  const runEncryption = () => {
    if (!activeKeys || !message) return;
    setMode('encrypt');
    setDecryptResult(null);
    
    if (algorithm === 'mh') {
      const { steps, ciphertext } = mhEncryptStep(message, activeKeys.publicKey);
      setResult({ steps, ciphertext, type: 'mh' });
    } else {
      const { steps, ciphertext } = egEncryptStep(message, activeKeys.publicKey);
      setResult({ steps, ciphertext, type: 'eg' });
    }
    setExpandedSteps({});
  };

  const runDecryption = () => {
    if (!activeKeys || !result) return;
    setMode('decrypt');
    
    if (algorithm === 'mh') {
      const { steps, message: decryptedMsg } = mhDecryptStep(result.ciphertext, activeKeys.privateKey);
      setDecryptResult({ steps, message: decryptedMsg });
    } else {
      const { steps, message: decryptedMsg } = egDecryptStep(result.ciphertext, activeKeys.privateKey);
      setDecryptResult({ steps, message: decryptedMsg });
    }
    setExpandedSteps({});
  };

  const toggleStep = (idx) => {
    setExpandedSteps(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const displaySteps = mode === 'encrypt' ? result?.steps : decryptResult?.steps;

  return (
    <div className="playground-container">
      <header className="chat-header" style={{ borderBottomColor: 'var(--color-accent)' }}>
        <h1 style={{ color: 'var(--color-accent)' }}>
          <Terminal size={20} /> CRYPTO PLAYGROUND
        </h1>
        <div className="header-actions">
          <span className="header-user">SUBJ: {user?.username}</span>
          <nav>
            <Link to="/chats" className="header-link"><Terminal size={14} /> CHANNELS</Link>
            <Link to="/keys" className="header-link"><KeyRound size={14} /> KEYS</Link>
            <Link to="/compare" className="header-link"><Activity size={14} /> COMPARE</Link>
            <button onClick={() => { logout(); navigate('/'); }} className="secondary">
              <LogOut size={14} /> LOGOUT
            </button>
          </nav>
        </div>
      </header>

      <main className="main-wrapper">
        <section className="terminal-section" style={{ borderTopColor: 'var(--color-accent)' }}>
          <h2 style={{ color: 'var(--color-accent)' }}><Lock size={16} /> ALGORITHM CONFIG</h2>
          
          <div className="config-grid">
            <div className="config-item">
              <label>Algorithm</label>
              <select value={algorithm} onChange={(e) => { setAlgorithm(e.target.value); setResult(null); setDecryptResult(null); }}>
                <option value="mh">Merkle-Hellman (Knapsack)</option>
                <option value="eg">ElGamal</option>
              </select>
            </div>
            
            <div className="config-item">
              <label>Key Source</label>
              <select value={keySource} onChange={(e) => { setKeySource(e.target.value); setResult(null); setDecryptResult(null); }}>
                <option value="demo">Generate Demo Keys</option>
                <option value="mine">Use My Keys</option>
              </select>
            </div>
            
            <div className="config-item">
              <label>Message</label>
              <input 
                type="text" 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                placeholder="Enter message..."
                maxLength={20}
              />
            </div>
          </div>

          <div className="action-buttons">
            <button className="primary" onClick={runEncryption}>
              <Play size={16} /> ENCRYPT
            </button>
            {result && (
              <button className="secondary" onClick={runDecryption}>
                <Unlock size={16} /> DECRYPT
              </button>
            )}
            <button className="secondary" onClick={() => { setResult(null); setDecryptResult(null); }}>
              <RotateCcw size={16} /> RESET
            </button>
          </div>
        </section>

        {activeKeys && (
          <section className="terminal-section">
            <h2><KeyRound size={16} /> {keySource === 'demo' ? 'DEMO KEYS' : 'YOUR KEYS'}</h2>
            <div className="keys-display">
              {algorithm === 'mh' ? (
                <>
                  <div className="key-section">
                    <h4>Public Key (B)</h4>
                    <code>[{activeKeys.publicKey.B.join(', ')}]</code>
                  </div>
                  <div className="key-section">
                    <h4>Private Key (W, q, r)</h4>
                    <code>W: [{activeKeys.privateKey.W.join(', ')}]</code>
                    <code>q: {activeKeys.privateKey.q}</code>
                    <code>r: {activeKeys.privateKey.r}</code>
                    <code>r⁻¹: {activeKeys.privateKey.rInverse}</code>
                  </div>
                </>
              ) : (
                <>
                  <div className="key-section">
                    <h4>Public Key (p, g, A)</h4>
                    <code>p: {activeKeys.publicKey.p}</code>
                    <code>g: {activeKeys.publicKey.g}</code>
                    <code>A: {activeKeys.publicKey.A}</code>
                  </div>
                  <div className="key-section">
                    <h4>Private Key (a)</h4>
                    <code>a: {activeKeys.privateKey.a}</code>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {displaySteps && (
          <section className="terminal-section" style={{ borderTopColor: 'var(--color-primary)' }}>
            <h2 style={{ color: 'var(--color-primary)' }}>
              {mode === 'encrypt' ? <Lock size={16} /> : <Unlock size={16} />} 
              {mode === 'encrypt' ? ' ENCRYPTION STEPS' : ' DECRYPTION STEPS'}
            </h2>
            
            <div className="steps-container">
              {displaySteps.map((step, idx) => (
                <div key={idx} className={`step-card ${expandedSteps[idx] ? 'expanded' : ''}`}>
                  <div className="step-header" onClick={() => toggleStep(idx)}>
                    {expandedSteps[idx] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span>{step.title}</span>
                  </div>
                  {expandedSteps[idx] && (
                    <div className="step-content">
                      <pre>{step.content}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {mode === 'decrypt' && decryptResult && (
              <div className="result-box" style={{ borderColor: 'var(--color-accent)', marginTop: '16px' }}>
                <h3>DECRYPTED MESSAGE</h3>
                <div className="terminal-display" style={{ borderColor: 'var(--color-accent)' }}>
                  <code>"{decryptResult.message}"</code>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
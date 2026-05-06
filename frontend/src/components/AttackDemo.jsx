import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/api';
import { ShieldAlert, LogOut, Terminal, KeyRound, AlertTriangle, Fingerprint, Crosshair, Play, Zap } from 'lucide-react';

export default function AttackDemo() {
  const [messages, setMessages] = useState([]);
  const [demoData, setDemoData] = useState(null);
  const [attacking, setAttacking] = useState(false);
  const [attackResults, setAttackResults] = useState({});
  const [error, setError] = useState('');
  const [attackAllResults, setAttackAllResults] = useState(null);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const initData = async () => {
      try {
        const demo = await api.attack.getDemoData();
        setDemoData(demo);
      } catch (err) {
        console.error('Failed to load demo data:', err);
      }
    };
    const fetchMessages = async () => {
      try {
        const data = await api.messages.getAllForAttack();
        setMessages(data.messages);
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };
    initData();
    fetchMessages();
  }, [user?.id]);

  const runAttack = async (publicKey, ciphertext, messageId = null) => {
    setAttacking(true);
    setError('');

    try {
      const startTime = Date.now();
      const result = await api.attack.run(publicKey, ciphertext, messageId);
      const endTime = Date.now();
      
      setAttackResults(prev => ({
        ...prev,
        [messageId || 'demo']: { ...result, timing: endTime - startTime }
      }));
      return result;
    } catch (err) {
      setError(err.message);
    } finally {
      setAttacking(false);
    }
  };

  const runAllAttacks = async () => {
    setAttacking(true);
    setAttackAllResults(null);
    setError('');
    
    const results = [];
    const startTime = Date.now();
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      try {
        const result = await api.attack.run(msg.mhPublicKey, msg.ciphertext, msg.id);
        results.push({ id: msg.id, ...result, otherUsername: msg.otherUsername });
      } catch (err) {
        results.push({ id: msg.id, success: false, message: err.message, otherUsername: msg.otherUsername });
      }
    }
    
    const endTime = Date.now();
    setAttackAllResults({
      total: messages.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      totalTime: endTime - startTime
    });
    setAttacking(false);
  };

  const formatCiphertext = (ct) => {
    if (Array.isArray(ct)) {
      return ct.slice(0, 3).join(', ') + (ct.length > 3 ? '...' : '');
    }
    try {
      const obj = JSON.parse(ct);
      if (obj.mh) {
        return obj.mh.slice(0, 3).join(', ') + (obj.mh.length > 3 ? '...' : '');
      }
    } catch {}
    return String(ct);
  };

  return (
    <div className="attack-demo-container">
      <header className="chat-header" style={{ borderBottomColor: 'var(--color-destructive)' }}>
        <h1 style={{ color: 'var(--color-destructive)', textShadow: '0 0 4px rgba(220, 38, 38, 0.5)' }}>
          <ShieldAlert size={20} /> OFFENSIVE OPS
        </h1>
        <div className="header-actions">
          <span className="header-user">SUBJ: {user?.username}</span>
          <nav>
            <Link to="/chats" className="header-link"><Terminal size={14} /> CHANNELS</Link>
            <Link to="/keys" className="header-link"><KeyRound size={14} /> KEYS</Link>
            <button onClick={() => { logout(); navigate('/'); }} className="secondary">
              <LogOut size={14} /> LOGOUT
            </button>
          </nav>
        </div>
      </header>

      <main className="main-wrapper">
        <section className="terminal-section" style={{ borderTopColor: 'var(--color-destructive)' }}>
          <h2 style={{ color: 'var(--color-destructive)' }}><AlertTriangle size={16} /> LLL LATTICE REDUCTION MODULE</h2>
          <div className="attack-desc">
            <p>
              This module executes <strong>Shamir's attack</strong> against the Merkle-Hellman knapsack cryptosystem.
            </p>
            <p>
              By treating the public key vector as a basis for a lattice, we apply the <strong>Lenstra-Lenstra-Lovasz (LLL)</strong> reduction algorithm to find the shortest vector, revealing the hidden superincreasing sequence and breaking the encryption.
            </p>
          </div>
        </section>

        {demoData && (
          <section className="terminal-section">
            <h2><Fingerprint size={16} /> SANDBOX ATTACK TARGET</h2>

            <div className="terminal-block">
              <h3>INTERCEPTED KEY (B):</h3>
              <div className="terminal-display">
                <code>[{demoData.publicKey.B.join(', ')}]</code>
              </div>

              <h3>CIPHERTEXT (C):</h3>
              <div className="terminal-display">
                <code>{formatCiphertext(demoData.ciphertext)}</code>
              </div>

              <h3>KNOWN PLAINTEXT:</h3>
              <div className="terminal-display" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}>
                <code>{demoData.originalMessage}</code>
              </div>

              <button
                style={{ backgroundColor: 'var(--color-destructive)', borderColor: 'var(--color-destructive)', marginTop: '16px' }}
                onClick={() => runAttack(demoData.publicKey, demoData.ciphertext)}
                disabled={attacking}
              >
                <Crosshair size={16} />
                {attacking ? 'EXECUTING LLL...' : 'INITIATE ATTACK'}
              </button>
            </div>

            {attackResults['demo'] && (
              <div className="result-box" style={{ borderColor: attackResults['demo'].success ? 'var(--color-accent)' : 'var(--color-destructive)', backgroundColor: attackResults['demo'].success ? 'rgba(5, 150, 105, 0.05)' : 'rgba(220, 38, 38, 0.05)' }}>
                <h3 style={{ color: attackResults['demo'].success ? 'var(--color-accent)' : 'var(--color-destructive)' }}>
                  {attackResults['demo'].success ? 'CRACK SUCCESSFUL' : 'ATTACK FAILED'}
                  {attackResults['demo'].timing && <span style={{ fontSize: '12px', marginLeft: '8px' }}>({attackResults['demo'].timing}ms)</span>}
                </h3>
                {attackResults['demo'].success ? (
                  <>
                    <p><strong>RECOVERED DATA:</strong></p>
                    <div className="terminal-display">
                      <code>{attackResults['demo'].message}</code>
                    </div>
                    <p style={{ marginTop: '12px', fontSize: '12px' }}><strong>RAW BITSTREAM:</strong> {attackResults['demo'].rawBits}</p>
                    <p className="result-success">{attackResults['demo'].explanation}</p>
                  </>
                ) : (
                  <p className="error">{attackResults['demo'].message}</p>
                )}
              </div>
            )}

            {error && <p className="error" style={{ marginTop: '16px' }}>{error}</p>}
          </section>
        )}

        {messages.length > 0 && (
          <section className="terminal-section" style={{ borderTopColor: '#F59E0B' }}>
            <h2 style={{ color: '#F59E0B' }}>
              <ShieldAlert size={16} /> DATABASE MESSAGES ({messages.length})
            </h2>
            
            <button
              style={{ backgroundColor: '#F59E0B', borderColor: '#F59E0B', marginBottom: '16px', width: '100%' }}
              onClick={runAllAttacks}
              disabled={attacking}
            >
              <Zap size={16} />
              {attacking ? 'EXECUTING MASS ATTACK...' : 'ATTACK ALL MESSAGES'}
            </button>

            {attackAllResults && (
              <div className="result-box" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'rgba(59, 130, 246, 0.05)', marginBottom: '16px' }}>
                <h3 style={{ color: 'var(--color-primary)' }}>MASS ATTACK COMPLETE</h3>
                <p><strong>TOTAL MESSAGES:</strong> {attackAllResults.total}</p>
                <p><strong>SUCCESSFUL:</strong> {attackAllResults.successful}</p>
                <p><strong>FAILED:</strong> {attackAllResults.failed}</p>
                <p><strong>TOTAL TIME:</strong> {attackAllResults.totalTime}ms</p>
              </div>
            )}

            <div className="intercepted-list">
              {messages.map(msg => (
                <div key={msg.id} className="intercepted-item">
                  <div className="msg-info">
                    MSG #{msg.id} | <strong>{msg.otherUsername}</strong>
                    {msg.senderId === user?.id ? ' → YOU' : ' → YOU'}
                  </div>
                  <div className="msg-details" style={{ fontSize: '11px', opacity: 0.7 }}>
                    FROM: {msg.direction === 'sent' ? msg.otherUsername : user?.username} → TO: {msg.direction === 'sent' ? user?.username : msg.otherUsername}
                  </div>
                  <div className="msg-details">
                    <code>C: {formatCiphertext(msg.ciphertext)}</code>
                  </div>
                  <button
                    className="attack-btn small"
                    style={{ backgroundColor: 'var(--color-destructive)', borderColor: 'var(--color-destructive)' }}
                    onClick={() => runAttack(msg.mhPublicKey, msg.ciphertext, msg.id)}
                    disabled={attacking}
                  >
                    <Crosshair size={12} /> ATTACK
                  </button>
                  
                  {attackResults[msg.id] && (
                    <div className="result-box small" style={{ 
                      borderColor: attackResults[msg.id].success ? 'var(--color-accent)' : 'var(--color-destructive)',
                      marginTop: '8px',
                      padding: '8px'
                    }}>
                      {attackResults[msg.id].success ? (
                        <><strong>RECOVERED:</strong> "{attackResults[msg.id].message}" <span style={{ opacity: 0.5 }}>({attackResults[msg.id].timing}ms)</span></>
                      ) : (
                        <span className="error">FAILED: {attackResults[msg.id].message}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {messages.length === 0 && (
          <section className="terminal-section" style={{ borderTopColor: '#6B7280' }}>
            <h2 style={{ color: '#6B7280' }}><Terminal size={16} /> NO MESSAGES FOUND</h2>
            <p style={{ color: '#9CA3AF' }}>Send messages through the app to see them here for attack.</p>
          </section>
        )}
      </main>
    </div>
  );
}

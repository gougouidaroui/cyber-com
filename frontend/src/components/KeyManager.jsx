import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/api';
import { KeyRound, LogOut, Shield, Database, Terminal, Play, Activity } from 'lucide-react';

export default function KeyManager() {
  const [keys, setKeys] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const data = await api.keys.getMy();
        setKeys(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchKeys();
  }, []);

  return (
    <div className="key-manager-container">
      <header className="chat-header">
        <h1><KeyRound size={20} /> KEY VAULT</h1>
        <div className="header-actions">
          <span className="header-user">SUBJ: {user?.username}</span>
          <nav>
            <Link to="/chats" className="header-link"><Terminal size={14} /> CHANNELS</Link>
            <Link to="/playground" className="header-link"><Play size={14} /> PLAYGROUND</Link>
            <Link to="/compare" className="header-link"><Activity size={14} /> COMPARE</Link>
            <button onClick={() => { logout(); navigate('/'); }} className="secondary">
              <LogOut size={14} /> LOGOUT
            </button>
          </nav>
        </div>
      </header>

      <main className="main-wrapper">
        {loading && <p className="loading"><Database size={24} /> ACCESSING KEYSTORE...</p>}
        {error && <p className="error">{error}</p>}

        {keys && (
          <>
            <section className="terminal-section">
              <h2><Shield size={16} /> MERKLE-HELLMAN SPECIFICATIONS</h2>

              <div className="terminal-block">
                <h3>PUBLIC KEY (DISGUISED VECTOR)</h3>
                <div className="terminal-display">
                  <p>B (COEFFICIENTS):</p>
                  <code>[{keys.mhPublicKey.B.join(', ')}]</code>
                  <p>BLOCK SIZE (N): {keys.mhPublicKey.n}</p>
                </div>
              </div>

              <div className="terminal-block">
                <h3>PRIVATE KEY (ENCRYPTED)</h3>
                <div className="terminal-display" style={{ borderColor: '#F59E0B' }}>
                  <p>⚠️ Private key is encrypted in database</p>
                  <code style={{ color: '#F59E0B' }}>{keys.mhPrivateKeyEncrypted.substring(0, 60)}...</code>
                </div>
              </div>
            </section>

            <section className="terminal-section">
              <h2><Shield size={16} /> ELGAMAL SPECIFICATIONS</h2>

              <div className="terminal-block">
                <h3>PUBLIC PARAMETERS</h3>
                <div className="terminal-display">
                  <p>PRIME (P):</p>
                  <code className="truncate">{keys.egPublicKey.p}</code>
                  <p>GENERATOR (G): {keys.egPublicKey.g}</p>
                  <p>PUBLIC EXP (A):</p>
                  <code className="truncate">{keys.egPublicKey.A}</code>
                </div>
              </div>

              <div className="terminal-block">
                <h3>PRIVATE KEY (ENCRYPTED)</h3>
                <div className="terminal-display" style={{ borderColor: '#F59E0B' }}>
                  <p>⚠️ Private key is encrypted in database</p>
                  <code style={{ color: '#F59E0B' }}>{keys.egPrivateKeyEncrypted.substring(0, 60)}...</code>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

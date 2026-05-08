import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/api';
import { Shield, Lock, User, LogIn } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.auth.login(username, password);
      login(data.token, data.user, data.sessionToken, password);
      navigate('/chats');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>
          <Shield size={28} />
          CyberCom
        </h1>
        <h2>SECURE TERMINAL ACCESS</h2>

        <form onSubmit={handleSubmit}>
          {error && <div className="error">{error}</div>}

          <div className="form-group">
            <label><User size={14} /> Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter subject ID"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label><Lock size={14} /> Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter passphrase"
              autoComplete="current-password"
            />
          </div>

          <button type="submit" disabled={loading}>
            <LogIn size={18} />
            {loading ? 'AUTHENTICATING...' : 'INITIALIZE CONNECTION'}
          </button>
        </form>

        <p className="auth-link">
          UNREGISTERED SUBJECT? <Link to="/register">REQUEST ACCESS</Link>
        </p>
      </div>
    </div>
  );
}

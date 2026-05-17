import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/api';
import { KeyRound, LogOut, MessageSquare, Terminal, Users, Play, Activity } from 'lucide-react';

export default function ChatList() {
  const [conversations, setConversations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllUsers, setShowAllUsers] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [convoData, usersData] = await Promise.all([
          api.messages.getConversations(),
          api.users.getAll()
        ]);
        setConversations(convoData.conversations);
        setAllUsers(usersData.users);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="chat-list">
      <header className="chat-header">
        <h1><Terminal size={20} /> CyberCom</h1>
        <div className="header-actions">
          <span className="header-user">SUBJ: {user?.username}</span>
          <nav>
            <Link to="/keys" className="header-link"><KeyRound size={14} /> Keys</Link>
            <Link to="/playground" className="header-link"><Play size={14} /> Playground</Link>
            <Link to="/compare" className="header-link"><Activity size={14} /> Compare</Link>
            <button onClick={() => { logout(); navigate('/'); }} className="secondary">
              <LogOut size={14} /> LOGOUT
            </button>
          </nav>
        </div>
      </header>

      <main className="main-wrapper">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="section-title">Active Channels</h2>
          <button 
            className="secondary" 
            onClick={() => setShowAllUsers(!showAllUsers)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1rem' }}
          >
            <Users size={14} /> {showAllUsers ? 'VIEW CHANNELS' : 'NEW TRANSMISSION'}
          </button>
        </div>

        {loading && <p className="loading"><Terminal size={24} /> SCANNING CHANNELS...</p>}
        {error && <p className="error">{error}</p>}

        {showAllUsers ? (
          <>
            {allUsers.length === 0 ? (
              <div className="empty-state">
                <Users size={48} opacity={0.5} />
                <p>NO OTHER SUBJECTS REGISTERED IN NETWORK.</p>
              </div>
            ) : (
              <ul className="conversation-list">
                {allUsers.map(u => (
                  <li key={u.id}>
                    <Link to={`/chat/${u.id}`} className="conversation-item">
                      <div className="avatar">{u.username.charAt(0).toUpperCase()}</div>
                      <span className="username">{u.username}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            {!loading && conversations.length === 0 && (
              <div className="empty-state">
                <MessageSquare size={48} opacity={0.5} />
                <p>NO ACTIVE CHANNELS FOUND.</p>
                <p>CLICK 'NEW TRANSMISSION' TO INITIATE HANDSHAKE.</p>
              </div>
            )}

            <ul className="conversation-list">
              {conversations.map(convo => (
                <li key={convo.id}>
                  <Link to={`/chat/${convo.id}`} className="conversation-item">
                    <div className="avatar">{convo.username.charAt(0).toUpperCase()}</div>
                    <span className="username">{convo.username}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

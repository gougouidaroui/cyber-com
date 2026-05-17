import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/api';
import { encryptMessage, decryptMessage } from '../utils/crypto';
import { unlockKeys } from '../utils/keyDerivation';
import { Shield, ArrowLeft, Send, KeyRound, Terminal, Lock, LogOut, Activity } from 'lucide-react';

export default function ChatRoom() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, sessionToken, password, logout } = useAuth();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [myKeys, setMyKeys] = useState(null);

  const messagesEndRef = useRef(null);

  const unlockAndGetKeys = async () => {
    const activePassword = password || sessionStorage.getItem('password');
    const activeSessionToken = sessionToken || localStorage.getItem('sessionToken');

    console.log('unlockAndGetKeys:', { hasPassword: !!activePassword, hasSessionToken: !!activeSessionToken, pwd: activePassword?.substring(0,3), tok: activeSessionToken?.substring(0,10) });

    if (!activePassword || !activeSessionToken) {
      throw new Error('Session expired, please login again');
    }

    const keysData = await api.keys.getMy();
    console.log('keysData received:', { hasMH: !!keysData.mhPrivateKeyEncrypted, hasEG: !!keysData.egPrivateKeyEncrypted });

    const mhPrivateKey = await unlockKeys(
      keysData.mhPrivateKeyEncrypted,
      activePassword,
      activeSessionToken
    );

    const egPrivateKey = await unlockKeys(
      keysData.egPrivateKeyEncrypted,
      activePassword,
      activeSessionToken
    );

    return {
      mh: mhPrivateKey,
      eg: egPrivateKey
    };
  };

  const fetchMessages = async () => {
    try {
      const data = await api.messages.getWithUser(userId);

      let keys = myKeys;
      if (!keys) {
        try {
          keys = await unlockAndGetKeys();
          setMyKeys(keys);
        } catch (unlockErr) {
          if (unlockErr.message.includes('Session expired') || unlockErr.message.includes('401')) {
            await logout();
            navigate('/');
            return;
          }
          throw unlockErr;
        }
      }

      let sentMessages = [];
      try {
        sentMessages = JSON.parse(localStorage.getItem('sentMessages')) || [];
      } catch (e) {
        sentMessages = [];
      }

      let sentIndex = 0;
      const decryptedMessages = data.messages.map((msg) => {
        if (msg.message === '[ENCRYPTED]' && msg.ciphertext) {
          const isSent = msg.sender_id === user.id;

          if (isSent && sentIndex < sentMessages.length) {
            return { ...msg, message: sentMessages[sentIndex++] };
          }

          if (keys) {
            try {
              const decrypted = decryptMessage(msg.ciphertext, keys);
              return { ...msg, message: decrypted };
            } catch {
              return { ...msg, message: '[DECRYPTION FAILED]' };
            }
          }
        }
        return msg;
      });

      setMessages(decryptedMessages);

      if (!partnerName && data.messages.length > 0) {
        const partnerId = data.messages[0].sender_id === user.id
          ? data.messages[0].receiver_id
          : data.messages[0].sender_id;
        const allUsers = await api.messages.getConversations();
        const partner = allUsers.conversations.find(c => c.id === partnerId);
        setPartnerName(partner?.username || 'Subject');
      }
    } catch (err) {
      if (err.message.includes('Session expired') || (err.response && err.response.status === 401)) {
        await logout();
        navigate('/');
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMessages([]);
    setMyKeys(null);
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => {
      clearInterval(interval);
      setMessages([]);
    };
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    setError('');

    try {
      const partnerKeys = await api.keys.getForUser(userId);
      const publicKey = {
        mh: partnerKeys.mhPublicKey,
        eg: partnerKeys.egPublicKey
      };

      const ciphertext = encryptMessage(newMessage, publicKey);
      await api.messages.send(userId, ciphertext);

      let sentMessages = [];
      try {
        sentMessages = JSON.parse(localStorage.getItem('sentMessages')) || [];
      } catch (e) {
        sentMessages = [];
      }
      sentMessages.push(newMessage);
      localStorage.setItem('sentMessages', JSON.stringify(sentMessages));

      setNewMessage('');
      setMyKeys(null);
      fetchMessages();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-room-container">
      <header className="chat-header">
        <Link to="/chats" className="header-link">
          <ArrowLeft size={16} /> ABORT
        </Link>
        <h2><Shield size={16} /> CHANNEL: {partnerName || 'SECURE'}</h2>
        <div className="header-actions">
          <nav>
            <Link to="/keys" className="header-link"><KeyRound size={14} /> KEYS</Link>
            <Link to="/playground" className="header-link"><Terminal size={14} /> PLAYGROUND</Link>
            <Link to="/compare" className="header-link"><Activity size={14} /> COMPARE</Link>
            <button onClick={() => { logout(); navigate('/'); }} className="header-link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-destructive)' }}>
              <LogOut size={14} /> LOGOUT
            </button>
          </nav>
        </div>
      </header>

      <main className="messages">
        {loading && <p className="loading">SYNCING CHANNEL...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && messages.length === 0 && (
          <div className="empty-state">
            <Lock size={48} opacity={0.5} />
            <p>SECURE CHANNEL ESTABLISHED.</p>
            <p>AWAITING ENCRYPTED TRANSMISSION.</p>
          </div>
        )}

        {messages.map(msg => {
          const isSent = msg.sender_id === user.id;
          return (
            <div key={msg.id} className={`message ${isSent ? 'sent' : 'received'}`}>
              <div className="message-content">
                <span className="message-label">
                  {isSent ? 'TX: USER' : `RX: ${partnerName}`}
                </span>
                <div className="message-text">{msg.message}</div>
              </div>
              <span className="timestamp">
                TS: {new Date(msg.created_at).toLocaleTimeString()}
              </span>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </main>

      <form className="message-input" onSubmit={handleSend}>
        <div className="message-input-wrapper">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="ENTER TRANSMISSION PAYLOAD..."
            disabled={sending}
            autoComplete="off"
          />
          <button type="submit" disabled={sending || !newMessage.trim()}>
            <Send size={16} />
            {sending ? 'TX...' : 'TRANSMIT'}
          </button>
        </div>
      </form>
    </div>
  );
}

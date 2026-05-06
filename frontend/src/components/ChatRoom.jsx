import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/api';
import { Shield, ArrowLeft, Send, KeyRound, ShieldAlert, Lock, Eye, EyeOff } from 'lucide-react';

export default function ChatRoom() {
  const { userId } = useParams();
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [visibleCiphertext, setVisibleCiphertext] = useState({});

  const messagesEndRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const data = await api.messages.getWithUser(userId);
      setMessages(data.messages);

      if (!partnerName && data.messages.length > 0) {
        const partnerId = data.messages[0].sender_id === user.id
          ? data.messages[0].receiver_id
          : data.messages[0].sender_id;
        const allUsers = await api.messages.getConversations();
        const partner = allUsers.conversations.find(c => c.id === partnerId);
        setPartnerName(partner?.username || 'Subject');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
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
      await api.messages.send(userId, newMessage);
      setNewMessage('');
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
            <Link to="/attack" className="header-link"><ShieldAlert size={14} /> ATTACK DEMO</Link>
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
                {visibleCiphertext[msg.id] && (
                  <div className="ciphertext-display">
                    <span className="ciphertext-label">ATTACKER VIEW (INTERCEPTED):</span>
                    <code>{msg.ciphertext}</code>
                  </div>
                )}
                <div className="message-actions">
                  <button
                    className="ciphertext-btn"
                    onClick={() => setVisibleCiphertext(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                  >
                    {visibleCiphertext[msg.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                    {visibleCiphertext[msg.id] ? 'HIDE ENCRYPTED' : 'VIEW ATTACKER VIEW'}
                  </button>
                </div>
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

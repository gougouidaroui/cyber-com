const API_URL = 'http://localhost:3000/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  auth: {
    register: (username, password) => request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
    login: (username, password) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
  },

  keys: {
    getMy: () => request('/keys/my'),
    getForUser: (userId) => request(`/keys/${userId}`)
  },

  users: {
    getAll: () => request('/users')
  },

  messages: {
    getConversations: () => request('/messages/conversations'),
    getWithUser: (userId) => request(`/messages/${userId}`),
    getAllForAttack: () => request('/messages/all/for-attack'),
    send: (receiverId, message) => request('/messages/send', {
      method: 'POST',
      body: JSON.stringify({ receiverId, message })
    }),
    decrypt: (messageId) => request(`/messages/decrypt/${messageId}`)
  },

  attack: {
    getIntercepted: () => request('/attack/intercepted'),
    intercept: (fromUserId, toUserId, message) => request('/attack/intercept', {
      method: 'POST',
      body: JSON.stringify({ fromUserId, toUserId, message })
    }),
    run: (mhPublicKey, ciphertext, messageId) => request('/attack/run', {
      method: 'POST',
      body: JSON.stringify({ mhPublicKey, ciphertext, messageId })
    }),
    getDemoData: () => request('/attack/demo-data')
  }
};
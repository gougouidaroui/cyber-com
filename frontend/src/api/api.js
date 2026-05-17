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
    }),
    logout: () => request('/auth/logout', { method: 'POST' })
  },

  keys: {
    getMy: () => request('/keys/my'),
    getForUser: (userId) => request(`/keys/${userId}`),
    unlock: () => request('/keys/unlock')
  },

  users: {
    getAll: () => request('/users')
  },

  messages: {
    getConversations: () => request('/messages/conversations'),
    getWithUser: (userId) => request(`/messages/${userId}`),
    send: (receiverId, ciphertext) => request('/messages/send', {
      method: 'POST',
      body: JSON.stringify({ receiverId, ciphertext })
    }),
    decrypt: (messageId) => request(`/messages/decrypt/${messageId}`)
  }
};
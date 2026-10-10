import api from './api';

// Contrato de authcore (Java): las respuestas no usan { success, data }.
// POST /auth/login → { token } · POST /auth/register → { id, username }
export const authService = {
  login: (username, password) => api.post('/auth/login', { username, password }).then((r) => r.data.token),
  register: ({ username, password, email }) =>
    api.post('/auth/register', { username, password, email: email || null }).then((r) => r.data),
};

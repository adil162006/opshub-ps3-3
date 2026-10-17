import api from '../utils/axios.js';

export async function loginUser(credentials) {
  const { data } = await api.post('/api/auth/login', credentials);
  return data;
}

export async function getMe() {
  const { data } = await api.get('/api/auth/me');
  return data;
}

export async function logoutUser() {
  await api.post('/api/auth/logout');
}

export async function verifyPhoneOtp(input) {
  const { data } = await api.post('/api/auth/otp/verify', input);
  return data;
}

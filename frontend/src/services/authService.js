import { api } from './api';

export const authService = {
  async register(form) {
    return api.post('/auth/register', form);
  },
  async login(form) {
    return api.post('/auth/login', form);
  },
  async logout() {
    return api.post('/auth/logout', {});
  },
  async me() {
    return api.get('/auth/me');
  }
};

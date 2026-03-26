import { api } from './api';

export const adminService = {
  listUsers: () => api.get('/admin/users')
};

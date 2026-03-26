import { api } from './api';

function withRange(startDate, endDate) {
  const query = new URLSearchParams();
  if (startDate) query.set('startDate', startDate);
  if (endDate) query.set('endDate', endDate);
  return query.toString() ? `?${query.toString()}` : '';
}

export const analyticsService = {
  getOverview: (startDate, endDate) => api.get(`/analytics/overview${withRange(startDate, endDate)}`),
  getUsers: (startDate, endDate) => api.get(`/analytics/users${withRange(startDate, endDate)}`),
  getEvents: (startDate, endDate) => api.get(`/analytics/events${withRange(startDate, endDate)}`),
  exportCsv: (startDate, endDate) => api.getCsv(`/analytics/export${withRange(startDate, endDate)}`),
  generateDemoData: () => api.post('/analytics/generate-demo-data', {})
};

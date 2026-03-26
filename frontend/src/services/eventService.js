import { api } from './api';

export const eventService = {
  track: (event) => api.post('/events/track', event)
};

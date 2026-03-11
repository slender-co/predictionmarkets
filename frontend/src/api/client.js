import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Sessions
export const getSessions = (params) => api.get('/sessions', { params }).then(r => r.data);
export const getSession = (id) => api.get(`/sessions/${id}`).then(r => r.data);
export const createSession = (data) => api.post('/sessions', data).then(r => r.data);
export const updateSession = (id, data) => api.put(`/sessions/${id}`, data).then(r => r.data);
export const deleteSession = (id) => api.delete(`/sessions/${id}`);
export const resolveSession = (id, data) => api.post(`/sessions/${id}/resolve`, data).then(r => r.data);
export const calibrateSession = (id) => api.post(`/sessions/${id}/calibrate`).then(r => r.data);

// Terms
export const createTerm = (sessionId, data) => api.post(`/sessions/${sessionId}/terms`, data).then(r => r.data);
export const createTermsBatch = (sessionId, data) => api.post(`/sessions/${sessionId}/terms/batch`, data).then(r => r.data);
export const updateTerm = (id, data) => api.put(`/terms/${id}`, data).then(r => r.data);
export const deleteTerm = (id) => api.delete(`/terms/${id}`);

// Analysis
export const previewAnalysis = (data) => api.post('/analysis/preview', data).then(r => r.data);
export const recalculateSession = (id) => api.post(`/analysis/recalculate/${id}`).then(r => r.data);
export const exportSession = (id) => api.get(`/analysis/export/${id}`).then(r => r.data);

// Base Rates
export const getBaseRates = (params) => api.get('/base-rates', { params }).then(r => r.data);
export const getBaseRateSummary = (params) => api.get('/base-rates/summary', { params }).then(r => r.data);
export const getBaseRateTrends = (params) => api.get('/base-rates/trends', { params }).then(r => r.data);
export const createBaseRate = (data) => api.post('/base-rates', data).then(r => r.data);

// Settings
export const getSettings = () => api.get('/settings').then(r => r.data);
export const updateSettings = (data) => api.put('/settings', data).then(r => r.data);

// Source Events
export const getSourceEvents = (params) => api.get('/source-events', { params }).then(r => r.data);
export const createSourceEvent = (data) => api.post('/source-events', data).then(r => r.data);
export const createSourceEventsBatch = (data) => api.post('/source-events/batch', data).then(r => r.data);
export const deleteSourceEvent = (id) => api.delete(`/source-events/${id}`);

// Calibration
export const getCalibrationLogs = (params) => api.get('/calibration', { params }).then(r => r.data);

export default api;

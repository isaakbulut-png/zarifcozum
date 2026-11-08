const axios = require('axios');

function createCurriculumService(options = {}) {
  const environment = options.environment || process.env;
  const baseURL = options.baseURL ?? environment.CURRICULUM_SERVICE_URL ??
    (environment.NODE_ENV === 'production' ? undefined : 'http://127.0.0.1:8000');
  const token = options.token ?? environment.CURRICULUM_SERVICE_TOKEN;
  const client = axios.create({
    baseURL,
    timeout: 10000,
    maxRedirects: 0,
    proxy: false,
    maxContentLength: 10 * 1024 * 1024,
    maxBodyLength: 1024 * 1024,
    validateStatus: () => true
  });

  async function request(method, path, options = {}) {
    if (!token || token.length < 32) {
      const error = new Error('CURRICULUM_SERVICE_TOKEN must contain at least 32 characters');
      error.code = 'CURRICULUM_NOT_CONFIGURED';
      throw error;
    }
    if (!baseURL) {
      const error = new Error('CURRICULUM_SERVICE_URL is required in production');
      error.code = 'CURRICULUM_SERVICE_URL_NOT_CONFIGURED';
      throw error;
    }
    let serviceUrl;
    try {
      serviceUrl = new URL(baseURL);
    } catch {
      const error = new Error('CURRICULUM_SERVICE_URL must be an absolute HTTP(S) URL');
      error.code = 'CURRICULUM_SERVICE_URL_INVALID';
      throw error;
    }
    if (!['http:', 'https:'].includes(serviceUrl.protocol) || !serviceUrl.hostname) {
      const error = new Error('CURRICULUM_SERVICE_URL must be an absolute HTTP(S) URL');
      error.code = 'CURRICULUM_SERVICE_URL_INVALID';
      throw error;
    }
    const hostname = serviceUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
    const isLoopback = hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname === '::1' || hostname === '0.0.0.0' || hostname.startsWith('127.');
    if (environment.NODE_ENV === 'production' && isLoopback) {
      const error = new Error('CURRICULUM_SERVICE_URL must not point to localhost in production');
      error.code = 'CURRICULUM_SERVICE_URL_LOOPBACK';
      throw error;
    }
    return client.request({
      method,
      url: path,
      ...options,
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  return {
    getTree: parentId => request('get', '/api/v1/curriculum/tree', {
      params: parentId === undefined ? {} : { parent_id: parentId }
    }),
    createNode: data => request('post', '/api/v1/curriculum/nodes', { data }),
    createAssignment: data => request('post', '/api/v1/assignments', { data }),
    getRecommendations: studentId => request('get', `/api/v1/students/${encodeURIComponent(studentId)}/recommendations`),
    getParentReport: studentId => request('get', `/api/v1/parents/${encodeURIComponent(studentId)}/report`),
    sendNotification: data => request('post', '/api/v1/notifications/send', {data})
  };
}

module.exports = { createCurriculumService };

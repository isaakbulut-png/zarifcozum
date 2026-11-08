const axios = require('axios');

function createCurriculumService({
  baseURL = process.env.CURRICULUM_SERVICE_URL || 'http://127.0.0.1:8000',
  token = process.env.CURRICULUM_SERVICE_TOKEN
} = {}) {
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

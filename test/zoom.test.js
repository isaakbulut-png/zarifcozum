const assert = require('node:assert/strict');
const test = require('node:test');
const axios = require('axios');
const { ZOOM_HOST_USER_ID, yapilandirildi, createZoomMeeting } = require('../lib/zoom');

test('Zoom uses the fixed host even when the environment specifies a different host', async () => {
  const keys = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_USER_ID'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalPost = axios.post;
  const calls = [];
  try {
    process.env.ZOOM_ACCOUNT_ID = 'account';
    process.env.ZOOM_CLIENT_ID = 'client';
    process.env.ZOOM_CLIENT_SECRET = 'secret';
    process.env.ZOOM_HOST_USER_ID = 'another@example.com';
    axios.post = async (url, body, options) => {
      calls.push({ url, body, options });
      if (url === 'https://zoom.us/oauth/token') {
        return { data: { access_token: 'token', expires_in: 3600 } };
      }
      return { data: { id: 123, join_url: 'https://zoom.example/join' } };
    };

    assert.equal(yapilandirildi(), true);
    await createZoomMeeting({ topic: 'Test' });
    assert.equal(ZOOM_HOST_USER_ID, 'isa.agbulut@gmail.com');
    assert.equal(calls[1].url, `https://api.zoom.us/v2/users/${encodeURIComponent(ZOOM_HOST_USER_ID)}/meetings`);
    delete process.env.ZOOM_HOST_USER_ID;
    assert.equal(yapilandirildi(), true);
  } finally {
    axios.post = originalPost;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

const assert = require('node:assert/strict');
const test = require('node:test');
const { redisOptions } = require('../lib/redis-options');

test('Upstash redis URLs use TLS with certificate verification enabled', () => {
  const options = redisOptions('redis://default:password@example.upstash.io:6379');
  assert.equal(options.url, 'rediss://default:password@example.upstash.io:6379');
  assert.equal(options.socket.tls, true);
  assert.equal(options.socket.connectTimeout, 3000);
  assert.notEqual(options.socket.rejectUnauthorized, false);
});

test('explicit TLS is preserved and local non-TLS Redis stays non-TLS', () => {
  assert.equal(redisOptions('rediss://example.test:6379').socket.tls, true);
  const local = redisOptions('redis://localhost:6379');
  assert.equal(local.url, 'redis://localhost:6379');
  assert.equal(local.socket.tls, undefined);
});

test('invalid Redis URLs fail without echoing connection credentials', () => {
  assert.throws(() => redisOptions('invalid secret'), error =>
    error instanceof TypeError && !error.message.includes('secret'));
  assert.throws(() => redisOptions('https://example.test'), /redis:\/\/ veya rediss:\/\//);
});

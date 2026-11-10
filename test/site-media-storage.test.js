const assert = require('node:assert/strict');
const test = require('node:test');
const {Readable} = require('node:stream');
const express = require('express');
const {PutObjectCommand, GetObjectCommand, DeleteObjectCommand} = require('@aws-sdk/client-s3');
const {
  createR2MediaStorage,
  createR2PrivateDocumentStorage,
  createConfiguredMediaStorage,
  createConfiguredPrivateDocumentStorage
} = require('../lib/site-media-storage');
const {createSiteMediaFilesRouter} = require('../routes/site-media-files');

const config = {
  accountId: '0123456789abcdef0123456789abcdef',
  bucket: 'public-media',
  accessKeyId: 'test',
  secretAccessKey: 'test'
};

test('R2 storage validates keys and sends the expected object operations', async () => {
  const commands = [];
  const storage = createR2MediaStorage({...config, client: {send: async command => {
    commands.push(command);
    return {Body: Readable.from(['image'])};
  }}});
  const key = 'site-media/1234abcd.png';
  await storage.put(key, Buffer.from('image'));
  await storage.get(key);
  await storage.remove(key);
  assert.ok(commands[0] instanceof PutObjectCommand);
  assert.equal(commands[0].input.ContentType, 'image/png');
  assert.equal(commands[0].input.StorageClass, 'STANDARD');
  assert.ok(commands[1] instanceof GetObjectCommand);
  assert.ok(commands[2] instanceof DeleteObjectCommand);
  assert.equal(commands[0].input.Bucket, 'public-media');
  await assert.rejects(storage.get('../secret.pdf'), /Geçersiz/);
  assert.throws(() => createConfiguredMediaStorage({SITE_MEDIA_STORAGE: 'r2'}, {}), /eksik/);
  assert.throws(() => createConfiguredMediaStorage({SITE_MEDIA_STORAGE: 'other'}, {}), /local veya r2/);
});

test('private document storage uses its own bucket and rejects public media keys', async () => {
  const commands = [];
  const storage = createR2PrivateDocumentStorage({
    ...config,
    bucket: 'private-documents',
    client: {send: async command => { commands.push(command); return {}; }}
  });
  const key = 'submissions/0123456789abcdef01234567/12345678-1234-4234-8234-123456789abc.pdf';
  await storage.put(key, Buffer.from('%PDF-1.7'));
  assert.ok(commands[0] instanceof PutObjectCommand);
  assert.equal(commands[0].input.Bucket, 'private-documents');
  assert.equal(commands[0].input.ContentType, 'application/pdf');
  assert.equal(commands[0].input.CacheControl, 'private, no-store');
  await assert.rejects(storage.put('site-media/1234abcd.png', Buffer.from('image')), /Geçersiz/);
  await assert.rejects(storage.put('submissions/0123456789abcdef01234567/not-a-uuid.pdf', Buffer.from('%PDF-1.7')), /Geçersiz/);
  assert.equal(createConfiguredPrivateDocumentStorage({}), null);
  assert.throws(() => createConfiguredPrivateDocumentStorage({R2_PRIVATE_BUCKET: 'private-documents'}), /eksik/);
});

test('media proxy returns only allowed media and reports missing or unavailable objects', async () => {
  const app = express();
  app.use('/uploads', createSiteMediaFilesRouter({
    async get(key) {
      if (key.includes('404')) throw Object.assign(new Error('missing'), {name: 'NoSuchKey'});
      if (key.includes('500')) throw new Error('unavailable');
      return {Body: Readable.from(['test image']), ContentLength: 10};
    }
  }));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}/uploads`;
  try {
    const ok = await fetch(`${base}/homepage/abcdef.png`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'image/png');
    assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await ok.text(), 'test image');
    assert.equal((await fetch(`${base}/homepage/404.png`)).status, 404);
    assert.equal((await fetch(`${base}/homepage/500.png`)).status, 503);
    assert.equal((await fetch(`${base}/private/abcdef.pdf`)).status, 404);
    assert.equal((await fetch(`${base}/submissions/0123456789abcdef01234567/12345678-1234-4234-8234-123456789abc.pdf`)).status, 404);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

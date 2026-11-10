const assert = require('node:assert/strict');
const test = require('node:test');
const {Readable} = require('node:stream');
const express = require('express');
const {PutObjectCommand, GetObjectCommand, DeleteObjectCommand} = require('@aws-sdk/client-s3');
const {createR2MediaStorage, createConfiguredMediaStorage} = require('../lib/site-media-storage');
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
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

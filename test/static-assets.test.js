const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');

test('favicon and animasyon routes serve valid static files with correct content types', async () => {
  const app = express();

  app.get(['/favicon.ico', '/favicon.svg', '/favicon-32x32.png'], (req, res) => {
    const fileName = req.path.replace(/^\//, '');
    const publicPath = path.join(__dirname, '..', 'public', fileName);
    if (fs.existsSync(publicPath)) return res.sendFile(publicPath);
    const rootPath = path.join(__dirname, '..', fileName);
    if (fs.existsSync(rootPath)) return res.sendFile(rootPath);
    res.status(404).end();
  });

  app.get('/animasyon.js', (req, res) => {
    const assetPath = path.join(__dirname, '..', 'assets', 'animasyon.js');
    if (fs.existsSync(assetPath)) return res.sendFile(assetPath);
    const rootPath = path.join(__dirname, '..', 'animasyon.js');
    if (fs.existsSync(rootPath)) return res.sendFile(rootPath);
    res.status(404).end();
  });

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. /favicon.ico should return 200
    const resIco = await fetch(`${baseUrl}/favicon.ico`);
    assert.equal(resIco.status, 200);
    assert.ok(resIco.headers.get('content-type').includes('image/'));

    // 2. /favicon.svg should return 200
    const resSvg = await fetch(`${baseUrl}/favicon.svg`);
    assert.equal(resSvg.status, 200);
    assert.ok(resSvg.headers.get('content-type').includes('image/svg+xml'));

    // 3. /animasyon.js should return 200 with javascript content-type (never text/html)
    const resJs = await fetch(`${baseUrl}/animasyon.js`);
    assert.equal(resJs.status, 200);
    assert.ok(resJs.headers.get('content-type').includes('javascript'));
    const jsText = await resJs.text();
    assert.ok(jsText.includes('animasyonOynat'));
  } finally {
    server.close();
  }
});

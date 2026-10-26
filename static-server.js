const express = require('express');
const path = require('path');
const { readdirSync } = require('fs');

const app = express();
const PORT = 3000;
const htmlPages = new Set(
  readdirSync(__dirname).filter(file => file.endsWith('.html'))
);

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/logo', express.static(path.join(__dirname, 'logo')));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/:file', (req, res, next) => {
  if (!htmlPages.has(req.params.file)) {
    return next();
  }

  res.sendFile(path.join(__dirname, req.params.file));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Sunucu hazır: http://localhost:${PORT}`);
});

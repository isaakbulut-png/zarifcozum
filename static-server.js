const express = require('express');
const path = require('path');
const { readdirSync } = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const htmlPages = new Set(
  readdirSync(__dirname).filter(file => file.endsWith('.html'))
);

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/logo', express.static(path.join(__dirname, 'logo')));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

app.get('/deneme-sinavi-optik.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'deneme-sinavi-optik.html'));
});

app.get(['/ogrenci-paneli.html', '/ogretmen-paneli.html'], (req, res) => {
  res.status(503).send('Bu paneller için kimlik doğrulaması gerekir. npm start komutuyla server.js sunucusunu başlatın.');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/:file', (req, res, next) => {
  if (!htmlPages.has(req.params.file)) {
    return next();
  }

  res.sendFile(path.join(__dirname, req.params.file));
});

app.listen(PORT, () => {
  console.log(`Sunucu hazır: http://localhost:${PORT}`);
});

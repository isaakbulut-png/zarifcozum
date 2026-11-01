const fs = require('fs');
const path = require('path');

// Aynı müfredat dosyası tarayıcıda window.MATEMATIK_MUFREDATI olarak kullanılır.
function mufredatiYukle(dosya = path.join(__dirname, '..', 'assets', 'matematik-mufredati.js')) {
  const pencere = {};
  new Function('window', fs.readFileSync(dosya, 'utf8'))(pencere);
  return pencere.MATEMATIK_MUFREDATI;
}

function konuVarMi(mufredat, sinif, konu) {
  const uniteler = mufredat?.[sinif];
  return Array.isArray(uniteler) && uniteler.some(unite => unite.topics.includes(konu));
}

module.exports = { mufredatiYukle, konuVarMi };

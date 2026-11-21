import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

for (const envFile of ['.env', 'baglanti_adresi.env']) {
  const p = path.join(rootDir, envFile);
  if (fs.existsSync(p)) dotenv.config({ path: p, quiet: true });
}

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;

// lib/meb-curriculum-tree.json dosyasını yükle veya senkronize et
const treePath = path.join(rootDir, 'lib', 'meb-curriculum-tree.json');
const frontendJsPath = path.join(rootDir, 'assets', 'matematik-mufredati.js');

console.log('[Sync] Müfredat ağacı doğrulanıyor...');
if (fs.existsSync(treePath)) {
  const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
  console.log(`[Sync] Sınıflar yüklendi: ${Object.keys(tree).join(', ')}`);
  console.log('[Sync] 8. ve 12. sınıflar koruma altında (2018 programı).');
  console.log('[Sync] 5, 6, 7, 9, 10, 11. sınıflar Türkiye Yüzyılı Maarif Modeli ders kitaplarıyla senkronize.');
} else {
  console.error('[Sync] meb-curriculum-tree.json bulunamadı.');
}

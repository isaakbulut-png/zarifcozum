const fs = require('node:fs/promises');
const path = require('node:path');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const TYPES = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.json': 'application/json'};
const MEDIA_KEY = /^(homepage|site-media)\/[a-f0-9-]+\.(png|jpe?g|webp|json)$/i;
const PRIVATE_DOCUMENT_TYPES = {'.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'};
const PRIVATE_DOCUMENT_KEY = /^(homeworks|submissions)\/[a-f0-9]{24}\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(pdf|png|jpe?g)$/i;

function assertKey(key) {
  if (typeof key !== 'string' || !MEDIA_KEY.test(key)) throw new TypeError('Geçersiz medya anahtarı.');
}

function createLocalMediaStorage({homepageDir, siteMediaDir}) {
  function filePath(key) {
    assertKey(key);
    const [folder, filename] = key.split('/');
    return path.join(folder === 'homepage' ? homepageDir : siteMediaDir, filename);
  }
  return {
    async put(key, buffer) {
      const destination = filePath(key);
      await fs.mkdir(path.dirname(destination), {recursive: true});
      await fs.writeFile(destination, buffer, {flag: 'wx'});
    },
    async remove(key) {
      try {
        await fs.unlink(filePath(key));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  };
}

function createR2MediaStorage({accountId, bucket, accessKeyId, secretAccessKey, jurisdiction = '', client}) {
  if (!/^[a-f0-9]{32}$/i.test(accountId || '') || !bucket || !accessKeyId || !secretAccessKey ||
      !['', 'eu', 'us'].includes(jurisdiction)) {
    throw new Error('R2 medya deposu ayarları eksik veya geçersiz.');
  }
  const endpoint = `https://${accountId}${jurisdiction ? `.${jurisdiction}` : ''}.r2.cloudflarestorage.com`;
  const s3 = client || new S3Client({region: 'auto', endpoint, credentials: {accessKeyId, secretAccessKey}});
  return {
    async put(key, buffer) {
      assertKey(key);
      await s3.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: buffer, StorageClass: 'STANDARD',
        ContentType: TYPES[path.extname(key).toLowerCase()]
      }));
    },
    async remove(key) {
      assertKey(key);
      await s3.send(new DeleteObjectCommand({Bucket: bucket, Key: key}));
    },
    async get(key) {
      assertKey(key);
      return s3.send(new GetObjectCommand({Bucket: bucket, Key: key}));
    }
  };
}

function createR2PrivateDocumentStorage({accountId, bucket, accessKeyId, secretAccessKey, jurisdiction = '', client}) {
  if (!/^[a-f0-9]{32}$/i.test(accountId || '') || !bucket || !accessKeyId || !secretAccessKey ||
      !['', 'eu', 'us'].includes(jurisdiction)) {
    throw new Error('R2 özel belge deposu ayarları eksik veya geçersiz.');
  }
  const endpoint = `https://${accountId}${jurisdiction ? `.${jurisdiction}` : ''}.r2.cloudflarestorage.com`;
  const s3 = client || new S3Client({region: 'auto', endpoint, credentials: {accessKeyId, secretAccessKey}});
  function assertDocumentKey(key) {
    if (typeof key !== 'string' || !PRIVATE_DOCUMENT_KEY.test(key)) throw new TypeError('Geçersiz özel belge anahtarı.');
  }
  return {
    async put(key, buffer) {
      assertDocumentKey(key);
      await s3.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: buffer, StorageClass: 'STANDARD',
        ContentType: PRIVATE_DOCUMENT_TYPES[path.extname(key).toLowerCase()],
        CacheControl: 'private, no-store'
      }));
    },
    async remove(key) {
      assertDocumentKey(key);
      await s3.send(new DeleteObjectCommand({Bucket: bucket, Key: key}));
    },
    async get(key) {
      assertDocumentKey(key);
      return s3.send(new GetObjectCommand({Bucket: bucket, Key: key}));
    }
  };
}

function createConfiguredMediaStorage(environment, directories) {
  const mode = environment.SITE_MEDIA_STORAGE || 'local';
  if (mode === 'local') return createLocalMediaStorage(directories);
  if (mode !== 'r2') throw new Error('SITE_MEDIA_STORAGE local veya r2 olmalıdır.');
  return createR2MediaStorage({
    accountId: environment.R2_ACCOUNT_ID,
    bucket: environment.R2_MEDIA_BUCKET,
    accessKeyId: environment.R2_MEDIA_ACCESS_KEY_ID,
    secretAccessKey: environment.R2_MEDIA_SECRET_ACCESS_KEY,
    jurisdiction: environment.R2_MEDIA_JURISDICTION || ''
  });
}

function createConfiguredPrivateDocumentStorage(environment) {
  const isConfigured = [
    environment.R2_PRIVATE_BUCKET,
    environment.R2_PRIVATE_ACCESS_KEY_ID,
    environment.R2_PRIVATE_SECRET_ACCESS_KEY,
    environment.R2_PRIVATE_JURISDICTION
  ].some(Boolean);
  if (!isConfigured) return null;
  return createR2PrivateDocumentStorage({
    accountId: environment.R2_ACCOUNT_ID,
    bucket: environment.R2_PRIVATE_BUCKET,
    accessKeyId: environment.R2_PRIVATE_ACCESS_KEY_ID,
    secretAccessKey: environment.R2_PRIVATE_SECRET_ACCESS_KEY,
    jurisdiction: environment.R2_PRIVATE_JURISDICTION || ''
  });
}

module.exports = {
  createLocalMediaStorage,
  createR2MediaStorage,
  createR2PrivateDocumentStorage,
  createConfiguredMediaStorage,
  createConfiguredPrivateDocumentStorage,
  MEDIA_KEY,
  PRIVATE_DOCUMENT_KEY,
  TYPES
};

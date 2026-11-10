const express = require('express');
const path = require('node:path');
const {pipeline} = require('node:stream/promises');
const {MEDIA_KEY, TYPES} = require('../lib/site-media-storage');

function createSiteMediaFilesRouter(storage) {
  const router = express.Router();
  router.get('/:folder/:filename', async (req, res, next) => {
    const key = `${req.params.folder}/${req.params.filename}`;
    if (!MEDIA_KEY.test(key)) return next();
    try {
      const object = await storage.get(key);
      if (!object.Body || typeof object.Body.pipe !== 'function') throw new Error('Medya akışı alınamadı.');
      res.set({
        'Content-Type': TYPES[path.extname(key).toLowerCase()],
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=3600'
      });
      if (Number.isSafeInteger(object.ContentLength)) res.set('Content-Length', String(object.ContentLength));
      await pipeline(object.Body, res);
    } catch (error) {
      if (res.headersSent) {
        console.error('Medya aktarımı tamamlanamadı:', error);
        return;
      }
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return res.status(404).send('Medya bulunamadı.');
      }
      console.error('Medya deposundan dosya alınamadı:', error);
      return res.status(503).send('Medya deposuna ulaşılamadı.');
    }
  });
  return router;
}

module.exports = {createSiteMediaFilesRouter};

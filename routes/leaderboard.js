const express = require('express');

function createLeaderboardRouter({requireStudent, pointsService}) {
  const router = express.Router();
  router.get('/', requireStudent, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json({leaderboard: await pointsService.leaderboard()});
    } catch (error) {
      console.error('Liderlik tablosu alınamadı:', error);
      res.status(500).json({mesaj: 'Liderlik tablosu alınamadı.'});
    }
  });
  return router;
}

module.exports = {createLeaderboardRouter};

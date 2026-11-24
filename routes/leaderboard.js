const express = require('express');

function createLeaderboardRouter({requireStudent, pointsService}) {
  const router = express.Router();
  router.get('/', requireStudent, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      const grade = req.query && req.query.grade ? Number(req.query.grade) : null;
      const currentUserId = req.session?.user?.id || '';
      const opts = {};
      if (Number.isInteger(grade) && grade >= 5 && grade <= 12) opts.grade = grade;
      if (currentUserId) opts.currentUserId = currentUserId;
      const list = Object.keys(opts).length
        ? await pointsService.leaderboard(opts)
        : await pointsService.leaderboard();
      res.json({leaderboard: list});
    } catch (error) {
      console.error('Liderlik tablosu alınamadı:', error);
      res.status(500).json({mesaj: 'Liderlik tablosu alınamadı.'});
    }
  });
  return router;
}

module.exports = {createLeaderboardRouter};

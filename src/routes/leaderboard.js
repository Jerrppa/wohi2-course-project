const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");

// GET /api/leaderboard
router.get("/", async (req, res, next) => {
  try {
    // Haetaan kaikki käyttäjät ja heidän OIKEAT vastauksensa
    const users = await prisma.user.findMany({
      include: {
        attempts: {
          where: { isCorrect: true }
        }
      }
    });

    // Lasketaan pisteet (1 oikea vastaus = 1 piste)
    const leaderboard = users
      .map(user => ({
        name: user.name,
        score: user.attempts.length
      }))
      .sort((a, b) => b.score - a.score) // Järjestetään laskevasti
      .slice(0, 5); // Otetaan vain Top 5

    res.json(leaderboard);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
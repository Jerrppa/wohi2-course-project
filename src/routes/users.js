const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");

// ==========================================
// GET /users/leaderboard
// ==========================================
router.get("/leaderboard", async (req, res, next) => {
  try {
    // 1. Group attempts by userId where isCorrect is true, and count them.
    // Order by the count in descending order, and take top 5.
    const topAttempts = await prisma.attempt.groupBy({
      by: ['userId'],
      where: { isCorrect: true },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    // 2. We only have userIds now. Let's fetch the actual user details (names).
    const userIds = topAttempts.map(a => a.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true } // Assuming your User model has 'name'. Change to 'username' if needed!
    });

    // 3. Combine the attempt counts with the user names
    const leaderboard = topAttempts.map(attempt => {
      const user = users.find(u => u.id === attempt.userId);
      return {
        userId: attempt.userId,
        userName: user?.name || "Unknown User",
        successfulAttempts: attempt._count.id
      };
    });

    return res.json(leaderboard);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
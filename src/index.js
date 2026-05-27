const express = require("express");
const app = express();
const questionRouter = require("./routes/questions"); 
const prisma = require("./lib/prisma");
const authRouter = require("./routes/auth");
const path = require('path');
const errorHandler = require("./middleware/errorHandler");
const usersRouter = require("./routes/users");
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, '..', 'public')));


// everything under /api/questions
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/questions", questionRouter);
app.use("/api/users", usersRouter);
app.use('/api/leaderboard', require('./routes/leaderboard'));

app.use((req, res) => {
  res.json({msg: "Not found"});
});
app.use(errorHandler);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

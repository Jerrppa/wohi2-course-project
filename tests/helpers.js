const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

async function resetDb() {
  await prisma.attempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.user.deleteMany();
}

async function registerAndLogin(email = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@test.io`, name = "A") {
  await request(app).post("/api/auth/register")
    .send({ email, password: "pw12345", name });
    
  const res = await request(app).post("/api/auth/login")
    .send({ email, password: "pw12345" });
    
  return res.body.token;
}

async function createQuestion(token, overrides = {}) {
  const res = await request(app).post("/api/questions")
    .set("Authorization", `Bearer ${token}`)
    .send({ question: "Sample Question?", answer: "Sample Answer.", ...overrides });
    
  return res.body;
}

module.exports = { resetDb, registerAndLogin, createQuestion, request, app, prisma };
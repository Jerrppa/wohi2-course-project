const bcrypt = require("bcrypt")
const { resetDb, request, app, prisma, registerAndLogin, createQuestion } = require("./helpers");
const { question } = require("../src/lib/prisma");

console.log("Loading auth.test.js..."); // If you don't see this in the terminal, the file is crashing on import!
beforeEach(resetDb);

it("registers, hashes the password, returns a token", async () => {
  const res = await request(app).post("/api/auth/register")
    .send({ email: "a@test.io", password: "pw12345", name: "A" });

  expect(res.status).toBe(201);
  expect(res.body.token).toEqual(expect.any(String));

  const user = await prisma.user.findUnique({ where: { email: "a@test.io" } });
  expect(user.password).not.toBe("pw12345");                          // not plain
  expect(await bcrypt.compare("pw12345", user.password)).toBe(true);  // valid hash
});
it("returns 403 when editing someone else's question", async () => {
  const aliceToken = await registerAndLogin("alice@test.io", "Alice");
  const question = await createQuestion(aliceToken, { question: "Alice's question" });

  console.log("DEBUG: Created Question Object:", question);
  
  const bobToken = await registerAndLogin("bob@test.io", "Bob");
  const res = await request(app).put(`/api/questions/${question.id}`)
    .set("Authorization", `Bearer ${bobToken}`)
    .send({ title: "hijacked", date: "2026-01-01", content: "x" });

  expect(res.status).toBe(403);

  const after = await prisma.question.findUnique({ where: { id: question.id } });
  expect(after.title).toBe("Alice's question");  // unchanged
});
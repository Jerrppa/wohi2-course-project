const { request, app, resetDb, registerAndLogin } = require("./helpers");

// Wrapped everything in a describe block so Vitest can find it!
describe("Boundaries tests", () => {

  beforeEach(async () => {
    await resetDb();
  });

  it("clamps limit above 100 to 100", async () => {
    const token = await registerAndLogin();
    const res = await request(app).get("/api/questions?limit=999")
      .set("Authorization", `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);   // clamped, not 999
  });

  it("treats page=0 and page=-1 as page=1", async () => {
    const token = await registerAndLogin();
    const a = await request(app).get("/api/questions?page=0")
      .set("Authorization", `Bearer ${token}`);
      
    // Fixed the typo here: "questins" -> "questions"
    const b = await request(app).get("/api/questions?page=-1")
      .set("Authorization", `Bearer ${token}`);
      
    expect(a.body.page).toBe(1);
    expect(b.body.page).toBe(1);
  });

  it("clamps limit above 100 to 100", async () => {
  const token = await registerAndLogin();
  const res = await request(app).get("/api/questions?limit=999")
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.limit).toBe(100);   // clamped, not 999
  });

  it("treats page=0 and page=-1 as page=1", async () => {
    const token = await registerAndLogin();
    const a = await request(app).get("/api/questions?page=0")
      .set("Authorization", `Bearer ${token}`);
    const b = await request(app).get("/api/questions?page=-1")
      .set("Authorization", `Bearer ${token}`);
    expect(a.body.page).toBe(1);
    expect(b.body.page).toBe(1);
  });
});
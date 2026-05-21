const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function main() {
  // Create a default user
  const hashedPassword = await bcrypt.hash("1234", 10);
  const user = await prisma.user.create({
    data: {
      email: "admin@example.com",
      password: hashedPassword,
      name: "Admin User",
    },
  });

  console.log("Created user:", user.email);

const seedQuestions = [
  {
    title: "Introduction to HTTP",
    date: new Date("2026-03-20"),
    content: "HTTP is the foundation of communication on the web. It defines how clients and servers exchange data.",
    keywords: ["http", "web"],
  },
  {
    title: "Understanding REST APIs",
    date: new Date("2026-03-22"),
    content: "REST is an architectural style that uses standard HTTP methods like GET, POST, PUT, and DELETE.",
    keywords: ["http", "api"],
  },
  {
    title: "Node.js Basics",
    date: new Date("2026-03-25"),
    content: "Node.js allows you to run JavaScript on the server using a non-blocking, event-driven architecture.",
    keywords: ["javascript", "backend"],
  },
  {
    title: "Introduction to Databases",
    date: new Date("2026-03-26"),
    content: "Databases store and organize data. Common types include relational databases like PostgreSQL and MySQL.",
    keywords: ["database", "backend"],
  },
];

  // 3. Luodaan kysymykset ja liitetään ne juuri luotuun testikäyttäjään
  for (const question of seedQuestions) {
    await prisma.question.create({
      data: {
        title: question.title,
        date: question.date,
        content: question.content,
        userId: user.id,
        keywords: {
          connectOrCreate: question.keywords.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
    });
  }

  console.log("Seed data inserted successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require('path');
const { z } = require("zod");
// 1. Properly imported Error classes!
const { NotFoundError, ValidationError } = require("../lib/errors");

const PostInput = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.union([z.string(), z.array(z.string())]).optional(),
});

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new ValidationError("Only image files are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Apply authentication to ALL routes
router.use(authenticate);

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError ||
      err?.message === "Only image files are allowed") {
    return res.status(400).json({ msg: err.message });
  }
  next(err); // pass through to global handler
});

function formatQuestion(question) {
  const userAttempts = question.attempts || [];
  const isSolved = userAttempts.some(a => a.isCorrect);

  return {
    ...question,
    question: question.title, 
    answer: question.content,
    date: question.date.toISOString().split("T")[0],
    keywords: question.keywords ? question.keywords.map((k) => k.name) : [],
    userName: question.user?.name || null,
    attemptCount: question._count?.attempts ?? 0,
    attemptsCount: question._count?.attempts ?? 0, 
    isSolved: isSolved, 
    solved: isSolved, 
    title: undefined,
    content: undefined,
    user: undefined,
    attempts: undefined, 
    _count: undefined,
  };
}

// ==========================================
// GET /questions (The missing route!)
// ==========================================
router.get("/", async (req, res, next) => {
  try {
    const { keyword } = req.query;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
    const skip = (page - 1) * limit;

    const where = keyword
      ? { keywords: { some: { name: keyword } } }
      : {};

    const [filteredQuestions, total] = await Promise.all([
      prisma.question.findMany({
          where,
          include: {
              keywords: true,
              user: true,
              attempts: { where: { userId: req.user.userId } }, 
              _count: { select: { attempts: true } },
          },
          orderBy: { id: "asc" },
          skip,
          take: limit,
      }),
      prisma.question.count({ where }),
    ]);

    return res.json({
      data: filteredQuestions.map(formatQuestion),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// GET /questions/:questionId
// ==========================================
router.get("/:questionId", async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { 
          keywords: true, 
          user: true,
          attempts: { where: { userId: req.user.userId } },
          _count: { select: { attempts: true } }  
      },
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }

    return res.json(formatQuestion(question));
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /questions
// ==========================================
router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    const data = PostInput.parse(req.body); 
    const { question, answer, keywords } = data; 
    
    const keywordsArray = Array.isArray(keywords) ? keywords : [];
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    const newQuestion = await prisma.question.create({
        data: {
        title: question, 
        content: answer, 
        imageUrl,
        date: new Date(), 
        userId: req.user.userId,
        keywords: {
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw }, create: { name: kw },
          })), 
        },
      },
      include: { keywords: true, user: true, _count: { select: { attempts: true } } },
    });
      
    return res.status(201).json(formatQuestion(newQuestion));
  } catch (err) {
      next(err);
  }
});

// ==========================================
// PUT /questions/:questionId
// ==========================================
router.put("/:questionId", upload.single("image"), isOwner, async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);
    const { question, answer, keywords } = req.body;

    const existingQuestion = await prisma.question.findUnique({ where: { id: questionId } });
    if (!existingQuestion) {
      throw new NotFoundError("Question not found");
    }

    if (!question || !answer) {
      throw new ValidationError("question and answer are mandatory");
    }
    
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : existingQuestion.imageUrl;
    const keywordsArray = Array.isArray(keywords) ? keywords : [];
    
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        title: question, 
        content: answer, 
        imageUrl,
        keywords: {
          set: [],
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
      include: { keywords: true, user: true, _count: { select: { attempts: true } } },
    });
    
    return res.json(formatQuestion(updatedQuestion));
  } catch (err) {
    next(err);
  }
});

// ==========================================
// DELETE /questions/:questionId
// ==========================================
router.delete("/:questionId", isOwner, async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { keywords: true, user: true, _count: { select: { attempts: true } } },
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }

    await prisma.question.delete({ where: { id: questionId } });

    return res.json({
      message: "Question deleted successfully",
      question: formatQuestion(question),
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /questions/:questionId/play
// ==========================================
router.post("/:questionId/play", async (req, res, next) => {
    try {
      const questionId = Number(req.params.questionId);
      const { answer } = req.body; 
    
      if (!answer) {
        throw new ValidationError("Answer is required");
      }
    
      const question = await prisma.question.findUnique({ where: { id: questionId } });
      if (!question) {
        throw new NotFoundError("Question not found");
      }
    
      const isCorrect = answer.trim().toLowerCase() === question.content.trim().toLowerCase();
    
      const attempt = await prisma.attempt.create({
        data: {
          userId: req.user.userId,
          questionId: questionId,
          userAnswer: answer,
          isCorrect: isCorrect,
        },
      });
    
      const correctAttemptsCount = await prisma.attempt.count({
        where: { 
          userId: req.user.userId, 
          questionId: questionId, 
          isCorrect: true 
        }
      });
    
      return res.status(201).json({
        message: isCorrect ? "Correct!" : "Incorrect!",
        correct: isCorrect, 
        isSolved: correctAttemptsCount > 0,
        correctAnswer: isCorrect ? question.content : "not this one! Try again.",
        attempt: attempt
      });
    } catch (err) {
      next(err);
    }
});

module.exports = router;
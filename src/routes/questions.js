const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require('path');
const { z } = require("zod");
const { NotFoundError, ValidationError } = require("../lib/errors");

// --- CLOUDINARY IMPORTS ---
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload image buffer to Cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const cld_upload_stream = cloudinary.uploader.upload_stream(
      { folder: "quiz_app_uploads" }, 
      (error, result) => {
        if (result) resolve(result.secure_url);
        else reject(error);
      }
    );
    streamifier.createReadStream(buffer).pipe(cld_upload_stream);
  });
};

const PostInput = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.union([z.string(), z.array(z.string())]).optional(),
});

// --- MEMORY STORAGE FOR CLOUDINARY ---
const storage = multer.memoryStorage();

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
  next(err); 
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
// GET /questions/random 
// ==========================================
router.get("/random", async (req, res, next) => {
  try {
    const allQuestions = await prisma.question.findMany({
      select: { id: true }
    });

    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const randomIds = shuffled.slice(0, 10).map(q => q.id);

    const randomQuestions = await prisma.question.findMany({
      where: { id: { in: randomIds } },
      include: {
        keywords: true,
        user: true,
        attempts: { where: { userId: req.user.userId } }, 
        _count: { select: { attempts: true } },
      }
    });

    return res.json(randomQuestions.map(formatQuestion));
  } catch (err) {
    next(err);
  }
});

// ==========================================
// GET /questions
// ==========================================
router.get("/", async (req, res, next) => {
  try {
    const { keyword } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
    const skip = (page - 1) * limit;
    const where = keyword ? { keywords: { some: { name: keyword } } } : {};

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

    if (!question) throw new NotFoundError("Question not found");
    return res.json(formatQuestion(question));
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /questions (UPDATED FOR CLOUDINARY & FORMDATA)
// ==========================================
router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    const data = PostInput.parse(req.body); 
    const { question, answer, keywords } = data; 
    
    // FIX: FormData sends keywords as a comma-separated string, we need to split it!
    let keywordsArray = [];
    if (Array.isArray(keywords)) {
      keywordsArray = keywords;
    } else if (typeof keywords === "string" && keywords.trim() !== "") {
      keywordsArray = keywords.split(",").map((k) => k.trim());
    }
    
    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer);
    }
    
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
// PUT /questions/:questionId (UPDATED FOR CLOUDINARY & FORMDATA)
// ==========================================
router.put("/:questionId", upload.single("image"), isOwner, async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);
    const { question, answer, keywords } = req.body;

    const existingQuestion = await prisma.question.findUnique({ where: { id: questionId } });
    if (!existingQuestion) throw new NotFoundError("Question not found");
    if (!question || !answer) throw new ValidationError("question and answer are mandatory");
    
    let imageUrl = existingQuestion.imageUrl; 
    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer); 
    }

    // FIX: Parsing keywords string into an array just like in POST
    let keywordsArray = [];
    if (Array.isArray(keywords)) {
      keywordsArray = keywords;
    } else if (typeof keywords === "string" && keywords.trim() !== "") {
      keywordsArray = keywords.split(",").map((k) => k.trim());
    }
    
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
    
    const existingQuestion = await prisma.question.findUnique({ where: { id: questionId } });
    if (!existingQuestion) throw new NotFoundError("Question not found");

    await prisma.question.delete({ where: { id: questionId } });
    
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /questions/:questionId/play (FIXED DATABASE CRASH!)
// ==========================================
router.post("/:questionId/play", async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);
    const { answer } = req.body;

    if (!answer) throw new ValidationError("answer is mandatory");

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundError("Question not found");

    // Check if the answer is correct (ignoring capitalization and extra spaces)
    const isCorrect = question.content.trim().toLowerCase() === answer.trim().toLowerCase();

    // Get userId safely (handles both req.user.userId and req.user.id structures)
    const currentUserId = req.user.userId || req.user.id;

    // Log the attempt into the database
    await prisma.attempt.create({
      data: {
        isCorrect: isCorrect,
        userAnswer: answer, // <-- THIS IS THE MISSING PIECE!
        userId: currentUserId,
        questionId: question.id
      }
    });

    if (isCorrect) {
      return res.json({ correct: true });
    } else {
      return res.json({ 
        correct: false, 
        correctAnswer: question.content
      });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
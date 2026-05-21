const { ZodError } = require("zod");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { AppError } = require("../lib/errors");

function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: "Invalid input", issues: err.issues });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }
  if (err instanceof jwt.JsonWebTokenError ||
      err instanceof jwt.TokenExpiredError) {
    return res.status(401).json({ message: "Invalid token" });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message });
  }
if (err.type === "entity.parse.failed") {                                                                                                                                                                    
    return res.status(400).json({ message: "Invalid JSON in request body" });                                                                                                                                
  }
  req.log?.error({err}, "Unhandled error");
  // req.log?.error({ err }, "unhandled error");
  res.status(500).json({ message: "Internal server error" });
}
module.exports = errorHandler;

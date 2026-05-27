const jwt = require("jsonwebtoken");
const { UnauthorizedError, ForbiddenError } = require("../lib/errors");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  // Fetch SECRET here so we are 100% sure the .env file has loaded
  const SECRET = process.env.JWT_SECRET;

  if (!authHeader?.startsWith("Bearer ")) {
    // Use next() to pass the error to your errorHandler
    return next(new UnauthorizedError("No token provided"));
  }
  
  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    // Use either pino logger or standard console
    if (req.log) {
      req.log.warn({}, "Error authenticating");
    } else {
      console.warn("Error authenticating");
    }
    
    // Pass the error forward to the errorHandler
    return next(new ForbiddenError("Invalid or expired token"));
  }
}

module.exports = authenticate;
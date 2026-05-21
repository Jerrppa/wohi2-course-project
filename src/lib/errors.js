class AppError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
class ValidationError   extends AppError { constructor(m="Invalid input")    { super(m, 400); } }
class UnauthorizedError extends AppError { constructor(m="Unauthorized")     { super(m, 401); } }
class ForbiddenError    extends AppError { constructor(m="Forbidden")        { super(m, 403); } }
class NotFoundError     extends AppError { constructor(m="Not found")        { super(m, 404); } }
class ConflictError     extends AppError { constructor(m="Conflict")         { super(m, 409); } }

module.exports = {
  AppError, ValidationError, UnauthorizedError,
  ForbiddenError, NotFoundError, ConflictError,
};
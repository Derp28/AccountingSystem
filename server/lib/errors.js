export class AppError extends Error {
  constructor(status, message, details = [], code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(details, message = details?.[0]?.message || "Please check the submitted values.") {
    super(422, message, details, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested record was not found.") {
    super(404, message, [], "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message, details = []) {
    super(409, message, details, "CONFLICT");
    this.name = "ConflictError";
  }
}

export function assert(condition, message, status = 400, details = []) {
  if (!condition) throw new AppError(status, message, details);
}

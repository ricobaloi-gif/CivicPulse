export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function success<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function error(code: string, message: string, status = 400, details?: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message, details },
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export const errorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CONFLICT: "CONFLICT",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

export function unauthorized(message = "Invalid or missing API key"): Response {
  return error(errorCodes.UNAUTHORIZED, message, 401);
}

export function forbidden(message = "Access denied"): Response {
  return error(errorCodes.FORBIDDEN, message, 403);
}

export function notFound(message = "Resource not found"): Response {
  return error(errorCodes.NOT_FOUND, message, 404);
}

export function validationError(message: string, details?: Record<string, unknown>): Response {
  return error(errorCodes.VALIDATION_ERROR, message, 400, details);
}

export function rateLimited(message = "Rate limit exceeded"): Response {
  return error(errorCodes.RATE_LIMITED, message, 429);
}

export function internalError(message = "Internal server error"): Response {
  return error(errorCodes.INTERNAL_ERROR, message, 500);
}

export function conflict(message = "Resource conflict"): Response {
  return error(errorCodes.CONFLICT, message, 409);
}

export function methodNotAllowed(message = "Method not allowed"): Response {
  return error(errorCodes.METHOD_NOT_ALLOWED, message, 405);
}
/**
 * Errores de dominio que las rutas API saben traducir a HTTP.
 *
 * La regla es no devolver `error.message` de SQLite ni de un `Error` genérico:
 * solo los mensajes que nosotros escribimos (validación, no encontrado,
 * conflicto) llegan al cliente. Lo inesperado se registra en el servidor y
 * responde con un mensaje estable.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code = "validation_error", details?: Record<string, unknown>) {
    super(400, code, message, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code = "not_found") {
    super(404, code, message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = "conflict") {
    super(409, code, message);
    this.name = "ConflictError";
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "El cuerpo de la solicitud es demasiado grande.") {
    super(413, "body_too_large", message);
    this.name = "PayloadTooLargeError";
  }
}

export function appErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AppError)) return null;
  return Response.json(
    {
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    },
    { status: error.status },
  );
}

/**
 * Respuesta para fallos no previstos. El detalle solo queda en los logs del
 * servidor; el cliente recibe un mensaje estable y accionable.
 */
export function unexpectedResponse(
  error: unknown,
  fallback: string,
  status = 500,
): Response {
  console.error(`[api] ${fallback}`, error);
  return Response.json(
    { error: fallback, code: "internal_error" },
    { status },
  );
}

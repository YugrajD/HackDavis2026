export class PersistenceConflictError extends Error {
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = "PersistenceConflictError";
  }
}

export function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000;
}

/**
 * Input Validation Utilities
 * Lightweight validation without external dependencies
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export interface ValidationSchema<T> {
  validate: (input: unknown) => ValidationResult<T>;
}

/**
 * Create a validator for session creation requests
 */
export function validateCreateSessionRequest(input: unknown): ValidationResult<{
  repo?: string;
  gitToken?: string;
  systemPrompt?: string;
}> {
  const errors: string[] = [];

  if (input === null || input === undefined) {
    return { success: true, data: {} };
  }

  if (typeof input !== "object") {
    return { success: false, errors: ["Request body must be an object"] };
  }

  const body = input as Record<string, unknown>;
  const result: { repo?: string; gitToken?: string; systemPrompt?: string } = {};

  // Validate repo
  if (body.repo !== undefined) {
    if (typeof body.repo !== "string") {
      errors.push("repo must be a string");
    } else if (body.repo.length > 0) {
      // Validate repo format: owner/repo or full URL
      const repoPattern = /^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+|https?:\/\/.+\.git)$/;
      if (!repoPattern.test(body.repo) && !body.repo.startsWith("https://github.com/")) {
        errors.push("repo must be in format 'owner/repo' or a valid git URL");
      }
      if (body.repo.length > 255) {
        errors.push("repo must be at most 255 characters");
      }
      result.repo = body.repo;
    }
  }

  // Validate gitToken
  if (body.gitToken !== undefined) {
    if (typeof body.gitToken !== "string") {
      errors.push("gitToken must be a string");
    } else if (body.gitToken.length > 0) {
      if (body.gitToken.length > 500) {
        errors.push("gitToken must be at most 500 characters");
      }
      // Basic sanity check - tokens shouldn't contain SQL injection patterns
      if (/['";]/.test(body.gitToken)) {
        errors.push("gitToken contains invalid characters");
      }
      result.gitToken = body.gitToken;
    }
  }

  // Validate systemPrompt
  if (body.systemPrompt !== undefined) {
    if (typeof body.systemPrompt !== "string") {
      errors.push("systemPrompt must be a string");
    } else if (body.systemPrompt.length > 0) {
      if (body.systemPrompt.length > 50000) {
        errors.push("systemPrompt must be at most 50000 characters");
      }
      result.systemPrompt = body.systemPrompt;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: result };
}

/**
 * Create a validator for send message requests
 */
export function validateSendMessageRequest(input: unknown): ValidationResult<{
  content: string;
}> {
  const errors: string[] = [];

  if (input === null || input === undefined) {
    return { success: false, errors: ["Request body is required"] };
  }

  if (typeof input !== "object") {
    return { success: false, errors: ["Request body must be an object"] };
  }

  const body = input as Record<string, unknown>;

  // Validate content (required)
  if (body.content === undefined || body.content === null) {
    errors.push("content is required");
  } else if (typeof body.content !== "string") {
    errors.push("content must be a string");
  } else if (body.content.trim().length === 0) {
    errors.push("content cannot be empty");
  } else if (body.content.length > 100000) {
    errors.push("content must be at most 100000 characters");
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: { content: (body.content as string).trim() } };
}

/**
 * Validate UUID format
 */
export function isValidUUID(value: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(value);
}

/**
 * Sanitize a string for safe database insertion
 * Note: This is a defense-in-depth measure; always use parameterized queries
 */
export function sanitizeString(value: string | undefined | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  // Remove null bytes and other dangerous characters
  return value.replace(/\0/g, "").trim();
}

/**
 * Input Validation Utilities
 * Lightweight validation without external dependencies
 */

import type { McpServerConfig, AgentConfig } from "../types";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export interface ValidationSchema<T> {
  validate: (input: unknown) => ValidationResult<T>;
}

// Maximum total config size (100KB)
const MAX_CONFIG_SIZE = 100 * 1024;

/**
 * Validate MCP server configuration
 */
function validateMcpServerConfig(
  name: string,
  config: unknown,
  errors: string[]
): McpServerConfig | null {
  if (typeof config !== "object" || config === null) {
    errors.push(`mcpServers.${name} must be an object`);
    return null;
  }

  const c = config as Record<string, unknown>;
  const result: McpServerConfig = { type: "local" };

  // Validate type (required)
  if (c.type !== "local" && c.type !== "remote") {
    errors.push(`mcpServers.${name}.type must be "local" or "remote"`);
    return null;
  }
  result.type = c.type;

  // Type-specific validation
  if (c.type === "local") {
    // Command is required for local servers
    if (!Array.isArray(c.command) || c.command.length === 0) {
      errors.push(`mcpServers.${name}.command is required for local servers and must be a non-empty array`);
      return null;
    }
    if (!c.command.every((item: unknown) => typeof item === "string")) {
      errors.push(`mcpServers.${name}.command must be an array of strings`);
      return null;
    }
    result.command = c.command as string[];

    // Validate environment (optional)
    if (c.environment !== undefined) {
      if (typeof c.environment !== "object" || c.environment === null) {
        errors.push(`mcpServers.${name}.environment must be an object`);
      } else {
        const env = c.environment as Record<string, unknown>;
        for (const [key, value] of Object.entries(env)) {
          if (typeof value !== "string") {
            errors.push(`mcpServers.${name}.environment.${key} must be a string`);
          }
        }
        result.environment = c.environment as Record<string, string>;
      }
    }
  } else {
    // URL is required for remote servers
    if (typeof c.url !== "string" || c.url.length === 0) {
      errors.push(`mcpServers.${name}.url is required for remote servers`);
      return null;
    }
    // Basic URL validation
    try {
      new URL(c.url);
    } catch {
      errors.push(`mcpServers.${name}.url must be a valid URL`);
      return null;
    }
    result.url = c.url;

    // Validate headers (optional)
    if (c.headers !== undefined) {
      if (typeof c.headers !== "object" || c.headers === null) {
        errors.push(`mcpServers.${name}.headers must be an object`);
      } else {
        const headers = c.headers as Record<string, unknown>;
        for (const [key, value] of Object.entries(headers)) {
          if (typeof value !== "string") {
            errors.push(`mcpServers.${name}.headers.${key} must be a string`);
          }
        }
        result.headers = c.headers as Record<string, string>;
      }
    }
  }

  // Common optional fields
  if (c.timeout !== undefined) {
    if (typeof c.timeout !== "number" || c.timeout <= 0) {
      errors.push(`mcpServers.${name}.timeout must be a positive number`);
    } else {
      result.timeout = c.timeout;
    }
  }

  if (c.enabled !== undefined) {
    if (typeof c.enabled !== "boolean") {
      errors.push(`mcpServers.${name}.enabled must be a boolean`);
    } else {
      result.enabled = c.enabled;
    }
  }

  return errors.length === 0 ? result : null;
}

/**
 * Validate agent configuration
 */
function validateAgentConfig(
  name: string,
  config: unknown,
  errors: string[]
): AgentConfig | null {
  if (typeof config !== "object" || config === null) {
    errors.push(`agents.${name} must be an object`);
    return null;
  }

  const c = config as Record<string, unknown>;
  const result: AgentConfig = { description: "" };

  // Description is required
  if (typeof c.description !== "string" || c.description.trim().length === 0) {
    errors.push(`agents.${name}.description is required and must be a non-empty string`);
    return null;
  }
  if (c.description.length > 1000) {
    errors.push(`agents.${name}.description must be at most 1000 characters`);
  }
  result.description = c.description;

  // Mode (optional)
  if (c.mode !== undefined) {
    if (c.mode !== "primary" && c.mode !== "subagent" && c.mode !== "all") {
      errors.push(`agents.${name}.mode must be "primary", "subagent", or "all"`);
    } else {
      result.mode = c.mode;
    }
  }

  // Model (optional)
  if (c.model !== undefined) {
    if (typeof c.model !== "string" || c.model.length === 0) {
      errors.push(`agents.${name}.model must be a non-empty string`);
    } else if (c.model.length > 100) {
      errors.push(`agents.${name}.model must be at most 100 characters`);
    } else {
      result.model = c.model;
    }
  }

  // Prompt (optional)
  if (c.prompt !== undefined) {
    if (typeof c.prompt !== "string") {
      errors.push(`agents.${name}.prompt must be a string`);
    } else if (c.prompt.length > 50000) {
      errors.push(`agents.${name}.prompt must be at most 50000 characters`);
    } else {
      result.prompt = c.prompt;
    }
  }

  // Temperature (optional)
  if (c.temperature !== undefined) {
    if (typeof c.temperature !== "number" || c.temperature < 0 || c.temperature > 1) {
      errors.push(`agents.${name}.temperature must be a number between 0 and 1`);
    } else {
      result.temperature = c.temperature;
    }
  }

  // Tools (optional)
  if (c.tools !== undefined) {
    if (typeof c.tools !== "object" || c.tools === null) {
      errors.push(`agents.${name}.tools must be an object`);
    } else {
      const tools = c.tools as Record<string, unknown>;
      for (const [key, value] of Object.entries(tools)) {
        if (typeof value !== "boolean") {
          errors.push(`agents.${name}.tools.${key} must be a boolean`);
        }
      }
      result.tools = c.tools as Record<string, boolean>;
    }
  }

  // Permission (optional)
  if (c.permission !== undefined) {
    if (typeof c.permission !== "object" || c.permission === null) {
      errors.push(`agents.${name}.permission must be an object`);
    } else {
      result.permission = c.permission as Record<string, Record<string, string>>;
    }
  }

  return result;
}

/**
 * Validate skill name format (owner/repo style)
 */
function validateSkillName(skill: string): boolean {
  // Format: owner/repo or owner/repo@version
  const pattern = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(@[a-zA-Z0-9._-]+)?$/;
  return pattern.test(skill) && skill.length <= 100;
}

/**
 * Create a validator for session creation requests
 */
export function validateCreateSessionRequest(input: unknown): ValidationResult<{
  repo?: string;
  gitToken?: string;
  systemPrompt?: string;
  mcpServers?: Record<string, McpServerConfig>;
  agents?: Record<string, AgentConfig>;
  skills?: string[];
}> {
  const errors: string[] = [];

  if (input === null || input === undefined) {
    return { success: true, data: {} };
  }

  if (typeof input !== "object") {
    return { success: false, errors: ["Request body must be an object"] };
  }

  // Check total config size
  const configSize = JSON.stringify(input).length;
  if (configSize > MAX_CONFIG_SIZE) {
    return { success: false, errors: [`Request body exceeds maximum size of ${MAX_CONFIG_SIZE} bytes`] };
  }

  const body = input as Record<string, unknown>;
  const result: {
    repo?: string;
    gitToken?: string;
    systemPrompt?: string;
    mcpServers?: Record<string, McpServerConfig>;
    agents?: Record<string, AgentConfig>;
    skills?: string[];
  } = {};

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

  // Validate mcpServers
  if (body.mcpServers !== undefined) {
    if (typeof body.mcpServers !== "object" || body.mcpServers === null || Array.isArray(body.mcpServers)) {
      errors.push("mcpServers must be an object");
    } else {
      const mcpServers = body.mcpServers as Record<string, unknown>;
      const serverNames = Object.keys(mcpServers);

      if (serverNames.length > 20) {
        errors.push("mcpServers cannot have more than 20 servers");
      }

      const validatedServers: Record<string, McpServerConfig> = {};
      for (const name of serverNames) {
        // Validate server name format
        if (!/^[a-zA-Z0-9_-]+$/.test(name) || name.length > 50) {
          errors.push(`mcpServers key "${name}" must be alphanumeric with underscores/hyphens, max 50 chars`);
          continue;
        }

        const validatedConfig = validateMcpServerConfig(name, mcpServers[name], errors);
        if (validatedConfig) {
          validatedServers[name] = validatedConfig;
        }
      }

      if (Object.keys(validatedServers).length > 0) {
        result.mcpServers = validatedServers;
      }
    }
  }

  // Validate agents
  if (body.agents !== undefined) {
    if (typeof body.agents !== "object" || body.agents === null || Array.isArray(body.agents)) {
      errors.push("agents must be an object");
    } else {
      const agents = body.agents as Record<string, unknown>;
      const agentNames = Object.keys(agents);

      if (agentNames.length > 10) {
        errors.push("agents cannot have more than 10 agents");
      }

      const validatedAgents: Record<string, AgentConfig> = {};
      for (const name of agentNames) {
        // Validate agent name format
        if (!/^[a-zA-Z0-9_-]+$/.test(name) || name.length > 50) {
          errors.push(`agents key "${name}" must be alphanumeric with underscores/hyphens, max 50 chars`);
          continue;
        }

        const validatedConfig = validateAgentConfig(name, agents[name], errors);
        if (validatedConfig) {
          validatedAgents[name] = validatedConfig;
        }
      }

      if (Object.keys(validatedAgents).length > 0) {
        result.agents = validatedAgents;
      }
    }
  }

  // Validate skills
  if (body.skills !== undefined) {
    if (!Array.isArray(body.skills)) {
      errors.push("skills must be an array");
    } else {
      if (body.skills.length > 20) {
        errors.push("skills cannot have more than 20 entries");
      }

      const validatedSkills: string[] = [];
      for (let i = 0; i < body.skills.length; i++) {
        const skill = body.skills[i];
        if (typeof skill !== "string") {
          errors.push(`skills[${i}] must be a string`);
        } else if (!validateSkillName(skill)) {
          errors.push(`skills[${i}] must be in format "owner/repo" (max 100 chars)`);
        } else {
          validatedSkills.push(skill);
        }
      }

      if (validatedSkills.length > 0) {
        result.skills = validatedSkills;
      }
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

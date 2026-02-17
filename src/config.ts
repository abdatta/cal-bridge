// ============================================================
// Default Configuration & Validation
// ============================================================

import { CalendarClientConfig } from "./types.js";

/** Default configuration values */
export const DEFAULT_CONFIG: CalendarClientConfig = {
  senderEmail: "abdatta1998@gmail.com",
  recipientEmail: "abhishek.datta.2027@anderson.ucla.edu",
  responseSenderEmail: "abhishek.datta.2027@anderson.ucla.edu",
  credentialsPath: "credentials.json",
  tokenPath: "token.json",
  pollIntervalMs: 3000,
  requestTimeoutMs: 180000,
  scopes: [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
  ],
};

/**
 * Merge user-provided partial config with defaults.
 * Validates required fields after merge.
 */
export function resolveConfig(
  partial?: Partial<CalendarClientConfig>,
): CalendarClientConfig {
  const config: CalendarClientConfig = {
    ...DEFAULT_CONFIG,
    ...partial,
  };

  // Validation
  if (!config.senderEmail) {
    throw new Error("Config: senderEmail is required");
  }
  if (!config.recipientEmail) {
    throw new Error("Config: recipientEmail is required");
  }
  if (!config.credentialsPath) {
    throw new Error("Config: credentialsPath is required");
  }
  if (config.pollIntervalMs < 500) {
    throw new Error("Config: pollIntervalMs must be at least 500ms");
  }
  if (config.requestTimeoutMs < 5000) {
    throw new Error("Config: requestTimeoutMs must be at least 5000ms");
  }

  return config;
}

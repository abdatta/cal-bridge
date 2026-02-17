// ============================================================
// Types & Interfaces for CalBridge
// ============================================================

import { gmail_v1 } from "googleapis";

/** Supported HTTP-like methods for the email API protocol */
export type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

/** Supported API actions */
export type ApiAction = "list" | "create" | "update" | "event" | "health";

// ============================================================
// Configuration
// ============================================================

export interface CalendarClientConfig {
  /** Gmail address to send requests from */
  senderEmail: string;

  /** Outlook address to send requests to */
  recipientEmail: string;

  /** Email address that sends response emails (for filtering inbox) */
  responseSenderEmail: string;

  /** Path to Google OAuth credentials.json */
  credentialsPath: string;

  /** Path to store/load OAuth token.json */
  tokenPath: string;

  /** How often to poll for response emails, in milliseconds */
  pollIntervalMs: number;

  /** How long to wait for a response before timing out, in milliseconds */
  requestTimeoutMs: number;

  /** Gmail API scopes required */
  scopes: string[];
}

// ============================================================
// API Response
// ============================================================

export interface ApiResponse {
  status: string;
  requestId: string;
  data?: unknown;
  error?: string;
  messageId?: string; // The Gmail message ID of the response
}

// ============================================================
// Event Data
// ============================================================

export interface CalendarEvent {
  id?: string;
  subject?: string;
  start?: string;
  end?: string;
  location?: string;
  body?: string;
  [key: string]: unknown;
}

export interface CreateEventData {
  subject: string;
  start: string;
  end: string;
  location?: string;
  body?: string;
  [key: string]: unknown;
}

export interface UpdateEventData {
  id: string;
  subject?: string;
  start?: string;
  end?: string;
  location?: string;
  body?: string;
  [key: string]: unknown;
}

// ============================================================
// Email Metadata
// ============================================================

export interface SentEmailMetadata {
  requestId: string;
  messageId: string;
  threadId: string;
  timestamp: number;
}

export interface ReceivedEmail {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  body: string;
  timestamp: number;
}

// ============================================================
// Errors
// ============================================================

export class CalendarApiError extends Error {
  public readonly code: string;
  public readonly requestId?: string;

  constructor(message: string, code: string, requestId?: string) {
    super(message);
    this.name = "CalendarApiError";
    this.code = code;
    this.requestId = requestId;
  }
}

// Error codes
export const ErrorCodes = {
  AUTH_FAILED: "AUTH_FAILED",
  SEND_FAILED: "SEND_FAILED",
  TIMEOUT: "TIMEOUT",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  MISSING_REQUEST_ID: "MISSING_REQUEST_ID",
  PARSE_ERROR: "PARSE_ERROR",
  NOT_CONNECTED: "NOT_CONNECTED",
  UNKNOWN: "UNKNOWN",
} as const;

/** Authenticated Gmail client type alias */
export type GmailClient = gmail_v1.Gmail;

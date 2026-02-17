// ============================================================
// Email Sender — Constructs and sends API request emails
// ============================================================

import { v4 as uuidv4 } from "uuid";
import {
  GmailClient,
  ApiMethod,
  ApiAction,
  SentEmailMetadata,
  CalendarApiError,
  ErrorCodes,
} from "./types.js";

/**
 * Build a RFC 2822 email string.
 * Gmail API requires base64url-encoded raw email.
 */
function buildRawEmail(
  from: string,
  to: string,
  subject: string,
  body: string,
): string {
  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];
  return messageParts.join("\r\n");
}

/**
 * Encode a raw email string to base64url format for the Gmail API.
 */
function encodeBase64Url(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Send an API request email via Gmail.
 *
 * - Generates a unique requestId (UUID v4)
 * - Constructs subject: `#calendarapi <METHOD> <ACTION>`
 * - Serializes the request body as JSON
 * - Sends via Gmail API
 * - Returns metadata for request tracking
 *
 * @param gmail - Authenticated Gmail client
 * @param method - HTTP-like method (GET, POST, PATCH, DELETE)
 * @param action - API action (list, create, update, event, health)
 * @param payload - Request body payload (will be merged with requestId)
 * @param senderEmail - From address
 * @param recipientEmail - To address
 * @returns Metadata about the sent email
 */
export async function sendApiEmail(
  gmail: GmailClient,
  method: ApiMethod,
  action: ApiAction,
  payload: Record<string, unknown>,
  senderEmail: string,
  recipientEmail: string,
): Promise<SentEmailMetadata> {
  const requestId = uuidv4();
  const subject = `#calendarapi ${method} ${action} [${requestId}]`;

  // Build JSON body with ONLY the payload (no requestId)
  // Power Automate enforces strict schema validation on the body
  const body = JSON.stringify(payload);

  const rawEmail = buildRawEmail(senderEmail, recipientEmail, subject, body);
  const encodedEmail = encodeBase64Url(rawEmail);

  try {
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
      },
    });

    const messageId = response.data.id ?? "";
    const threadId = response.data.threadId ?? "";

    return {
      requestId,
      messageId,
      threadId,
      timestamp: Date.now(),
    };
  } catch (error) {
    throw new CalendarApiError(
      `Failed to send email: ${(error as Error).message}`,
      ErrorCodes.SEND_FAILED,
      requestId,
    );
  }
}

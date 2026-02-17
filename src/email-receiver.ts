// ============================================================
// Response Watcher — Polls for a specific API response
// ============================================================

import {
  GmailClient,
  ReceivedEmail,
  ApiResponse,
  CalendarApiError,
  ErrorCodes,
} from "./types.js";
import * as fs from "fs";
import { Logger } from "./logger.js";

/**
 * Polls the Gmail inbox for a reply email matching a specific Request ID.
 * Stops automatically when the response is found or timeout is reached.
 */
export class ResponseWatcher {
  private gmail: GmailClient;
  private responseSenderEmail: string;
  private requestId: string;
  private pollIntervalMs: number;
  private timeoutMs: number;
  private startTime: number;
  private processedMessageIds: Set<string> = new Set();
  private logger: Logger;

  constructor(
    gmail: GmailClient,
    responseSenderEmail: string,
    requestId: string,
    pollIntervalMs: number = 2000,
    timeoutMs: number = 30000,
    logger: Logger,
  ) {
    this.gmail = gmail;
    this.responseSenderEmail = responseSenderEmail;
    this.requestId = requestId;
    this.pollIntervalMs = pollIntervalMs;
    this.timeoutMs = timeoutMs;
    this.logger = logger;
    this.startTime = Date.now();
  }

  /**
   * Polls until the specific response is found or timeout occurs.
   */
  async waitForResponse(): Promise<ApiResponse> {
    this.logger.log(
      `[ResponseWatcher] Waiting for response to ${this.requestId}...`,
    );
    return new Promise<ApiResponse>((resolve, reject) => {
      const check = async () => {
        if (Date.now() - this.startTime > this.timeoutMs) {
          reject(
            new CalendarApiError(
              `Request timed out after ${this.timeoutMs}ms`,
              ErrorCodes.TIMEOUT,
              this.requestId,
            ),
          );
          return;
        }

        try {
          const response = await this.poll();
          if (response) {
            this.logger.log(`Found response for ${this.requestId}\n`);
            resolve(response);
          } else {
            setTimeout(check, this.pollIntervalMs);
          }
        } catch (err) {
          this.logger.error(
            `[ResponseWatcher] Error polling for ${this.requestId}:`,
            err,
          );
          // Keep trying until timeout
          setTimeout(check, this.pollIntervalMs);
        }
      };

      check();
    });
  }

  /**
   * Perform a single poll check:
   * 1. Search for unread emails from the sender
   * 2. Check if any match the Request ID in the subject
   * 3. Extract and parse JSON body
   */
  private async poll(): Promise<ApiResponse | null> {
    // Build Gmail search query
    // Optimization: limit search to very recent emails
    const afterDate = new Date(this.startTime - 60000); // 1 min buffer before start
    const afterStr = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;
    // Search for the specific Request ID in the subject to filter server-side if possible,
    // but Gmail search on subject is token-based. We'll search for the sender and unread status.
    // We can iterate and filter client-side.
    // Search for the specific Request ID in the subject to filter server-side if possible,
    // but Gmail search on subject is token-based. We'll search for the sender and unread status.
    // We can iterate and filter client-side.
    const query = `from:${this.responseSenderEmail} is:unread after:${afterStr}`;

    const listResponse = await this.gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 35,
    });

    const messages = listResponse.data.messages;
    if (!messages || messages.length === 0) return null;

    for (const msg of messages) {
      if (!msg.id) continue;

      // Skip already processed messages
      if (this.processedMessageIds.has(msg.id)) continue;
      this.processedMessageIds.add(msg.id);

      const email = await this.fetchAndParseMessage(msg.id);
      if (!email) continue;

      // Double check header subject contains request ID
      if (!email.subject.includes(this.requestId)) continue;

      const apiResponse = this.extractApiResponse(
        email.body,
        this.requestId,
        msg.id,
      );

      if (apiResponse) {
        // Mark as read only if we successfully parsed it
        await this.markAsRead(msg.id);
        return apiResponse;
      }
    }

    return null;
  }

  /**
   * Fetch a full message by ID and extract relevant fields.
   */
  private async fetchAndParseMessage(
    messageId: string,
  ): Promise<ReceivedEmail | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      const message = response.data;
      if (!message) return null;

      const headers = message.payload?.headers ?? [];
      const from =
        headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
      const subject =
        headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";

      // Extract body text
      const body = this.extractBody(message.payload);

      return {
        messageId: message.id ?? "",
        threadId: message.threadId ?? "",
        from,
        subject,
        body,
        timestamp: parseInt(message.internalDate ?? "0", 10),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Recursively extract plain text body from a Gmail message payload.
   */
  private extractBody(payload: any): string {
    if (!payload) return "";

    // Direct body data
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }

    // Multipart — look for text/plain first, then text/html
    if (payload.parts) {
      // Prefer text/plain
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          return Buffer.from(part.body.data, "base64").toString("utf-8");
        }
      }

      // Fallback: recurse into multipart parts
      for (const part of payload.parts) {
        const body = this.extractBody(part);
        if (body) return body;
      }
    }

    return "";
  }

  /**
   * Parse an email body as JSON API response.
   */
  private extractApiResponse(
    body: string,
    requestId: string,
    messageId: string,
  ): ApiResponse | null {
    this.logger.log(`[ResponseWatcher] Extracting response for ${requestId}`);
    // Strip email history if delimiter is present
    // We want to keep the NEW content (at the top), so we take substring(0, index)
    const delimiter = "________________________________________";
    const delimiterIndex = body.indexOf(delimiter);
    if (delimiterIndex !== -1) {
      body = body.substring(0, delimiterIndex);
    }

    // Replace newlines with escaped newlines
    body = body.replace(/\r/g, "\\r").replace(/\n/g, "\\n");

    // Simplified robust parsing: find the first '{' and last '}'
    const startIndex = body.indexOf("{");
    const endIndex = body.lastIndexOf("}");

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
      return null;
    }

    const potentialJson = body.substring(startIndex, endIndex + 1);

    try {
      const parsed = JSON.parse(potentialJson);

      if (typeof parsed === "object" && parsed !== null) {
        return { requestId, messageId, ...parsed } as ApiResponse;
      }
    } catch (err) {
      // Ignore parse errors
    }

    return null;
  }

  /**
   * Mark a message as read by removing the UNREAD label.
   */
  private async markAsRead(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: ["UNREAD"],
        },
      });
    } catch {
      // Non-critical: don't fail the whole flow if marking as read fails
    }
  }
}

// ============================================================
// CalendarEmailClient — High-Level Public API
// ============================================================

import { GmailAuth } from "./auth.js";
import { sendApiEmail } from "./email-sender.js";
import { ResponseWatcher } from "./email-receiver.js";
import { resolveConfig } from "./config.js";
import {
  CalendarClientConfig,
  ApiResponse,
  CreateEventData,
  UpdateEventData,
  ApiMethod,
  ApiAction,
  GmailClient,
  CalendarApiError,
  ErrorCodes,
} from "./types.js";

/**
 * CalendarEmailClient
 *
 * The main public interface for the CalBridge library.
 * Abstracts all email mechanics behind clean async methods.
 *
 * Usage:
 * ```ts
 * const client = new CalendarEmailClient({ ... });
 * await client.connect();
 * const events = await client.listEvents('2026-02-11T00:00:00Z', '2026-02-12T00:00:00Z');
 * await client.disconnect();
 * ```
 */
export class CalendarEmailClient {
  private config: CalendarClientConfig;
  private auth: GmailAuth;
  private gmail: GmailClient | null = null;
  private connected = false;

  constructor(config?: Partial<CalendarClientConfig>) {
    this.config = resolveConfig(config);
    this.auth = new GmailAuth(this.config);
  }

  // ============================================================
  // Connection Lifecycle
  // ============================================================

  /**
   * Authenticate with Gmail.
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    // Authenticate
    this.gmail = await this.auth.authenticate();
    this.connected = true;

    console.log("📧 CalBridge client connected");
  }

  /**
   * Disconnects the client (placeholder for now as no persistent connection)
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    console.log("📧 CalBridge client disconnected");
  }

  /** Whether the client is currently connected */
  get isConnected(): boolean {
    return this.connected;
  }

  // ============================================================
  // High-Level API Methods
  // ============================================================

  /**
   * Fetch calendar events within a date range.
   *
   * @param start - ISO 8601 start datetime (e.g., '2026-02-11T00:00:00Z')
   * @param end - ISO 8601 end datetime (e.g., '2026-02-12T00:00:00Z')
   * @returns Parsed API response containing event data
   */
  async listEvents(start: string, end: string): Promise<ApiResponse> {
    return this.sendRequest("GET", "list", { start, end });
  }

  /**
   * Create a new calendar event.
   *
   * @param eventData - Event details (subject, start, end, location, etc.)
   * @returns Parsed API response with result
   */
  async createEvent(eventData: CreateEventData): Promise<ApiResponse> {
    return this.sendRequest(
      "POST",
      "create",
      eventData as Record<string, unknown>,
    );
  }

  /**
   * Update an existing calendar event.
   *
   * @param eventData - Event fields to update (must include id)
   * @returns Parsed API response with result
   */
  async updateEvent(eventData: UpdateEventData): Promise<ApiResponse> {
    return this.sendRequest(
      "PATCH",
      "update",
      eventData as Record<string, unknown>,
    );
  }

  /**
   * Delete a calendar event by ID.
   *
   * @param eventId - The ID of the event to delete
   * @returns Parsed API response with result
   */
  async deleteEvent(eventId: string): Promise<ApiResponse> {
    return this.sendRequest("DELETE", "event", { id: eventId });
  }

  /**
   * Send a health check to verify the API pipeline is working.
   *
   * @returns Parsed API response with health status
   */
  async healthCheck(): Promise<ApiResponse> {
    return this.sendRequest("GET", "health", {});
  }

  // ============================================================
  // Internal: Request Orchestration
  // ============================================================

  /**
   * Core method: send a request email and wait for the matching response.
   *
   * 1. Validates connection
   * 2. Sends email via Gmail API
   * 3. Starts a watcher for the response
   * 4. Returns the response
   */
  private async sendRequest(
    method: ApiMethod,
    action: ApiAction,
    payload: Record<string, unknown>,
  ): Promise<ApiResponse> {
    this.ensureConnected();

    // Send the email
    const sentMeta = await sendApiEmail(
      this.gmail!,
      method,
      action,
      payload,
      this.config.senderEmail,
      this.config.recipientEmail,
    );

    // Watch for response
    const watcher = new ResponseWatcher(
      this.gmail!,
      this.config.responseSenderEmail,
      sentMeta.requestId,
      this.config.pollIntervalMs,
      this.config.requestTimeoutMs,
    );

    const response = await watcher.waitForResponse();

    // Cleanup emails on success (fire and forget to not block return)
    const messagesToDelete = [sentMeta.messageId];
    if (response.messageId) {
      messagesToDelete.push(response.messageId);
    }
    this.cleanupMessages(messagesToDelete).catch((err) => {
      console.error("Failed to cleanup emails:", err);
    });

    return response;
  }

  private ensureConnected(): void {
    if (!this.connected || !this.gmail) {
      throw new CalendarApiError(
        "Client is not connected. Call connect() first.",
        ErrorCodes.NOT_CONNECTED,
      );
    }
  }

  /**
   * Move messages to trash.
   */
  private async cleanupMessages(messageIds: string[]): Promise<void> {
    if (!this.gmail || messageIds.length === 0) return;

    try {
      await this.gmail.users.messages.batchModify({
        userId: "me",
        requestBody: {
          ids: messageIds,
          addLabelIds: ["TRASH"],
        },
      });
      console.log(`[Cleanup] Moved ${messageIds.length} messages to trash.`);
    } catch (error) {
      console.error("[Cleanup] Error moving messages to trash:", error);
    }
  }
}

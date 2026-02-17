// ============================================================
// Public Entry Point
// ============================================================

export { CalendarEmailClient } from "./client.js";
export { GmailAuth } from "./auth.js";
export { resolveConfig, DEFAULT_CONFIG } from "./config.js";

export type {
  CalendarClientConfig,
  ApiResponse,
  ApiMethod,
  ApiAction,
  CalendarEvent,
  CreateEventData,
  UpdateEventData,
} from "./types.js";

export { CalendarApiError, ErrorCodes } from "./types.js";

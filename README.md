# CalBridge (cal-bridge)

**CalBridge** — a TypeScript client library that bridges calendar systems through an **email-based API protocol**. A nudge towards California (UCLA) and the idea of a Calendar Bridging library. It authenticates via Gmail OAuth, sends structured request emails, polls for JSON responses, and exposes clean async functions — abstracting away all email mechanics.

## How It Works

```
Application Code → CalendarEmailClient → Gmail OAuth → Send Email → Power Automate → Calendar
                                                                     ↓
                   Return parsed result ← Match requestId ← Parse JSON ← Receive Reply Email
```

> [!NOTE]
> **Current Limitations**: As of this version, the Power Automate backend only supports the **Get list** API (`listEvents`). All other methods (`createEvent`, `updateEvent`, `deleteEvent`) are currently **no-ops** in this client library. They will log a warning and return a skipped status without sending an email.
>
> **Developer Note**: Supported actions are configured via the `supportedActions` list in `src/client.ts`. As the backend adds support for more actions, add them to this list to enable them in the client.

## Quick Start

### 1. Prerequisites

- **Node.js** 18+
- **Google Cloud Project** with Gmail API enabled
- **OAuth 2.0 Credentials** (Desktop app type)

### 2. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable **Gmail API**
4. Create **OAuth 2.0 Client ID** (Desktop application)
5. Copy your Client ID, Client Secret, and Project ID

### 3. Install

```bash
npm install cal-bridge
```

Or clone and build from source:

```bash
git clone <repo-url>
cd cal-bridge
npm install
npm run build
```

### 4. Environment Setup

Or obtain a `credentials.json` from Google Cloud Console.

### 5. Usage

You must providing the credentials object to the client. You can load this from a file or environment variables.

```typescript
import { CalendarEmailClient } from "cal-bridge";

// Example: Loading from env vars or a JSON file
const credentials = {
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uris: ["http://localhost:3847/oauth2callback"],
};

const client = new CalendarEmailClient({
  credentials, // Required
  debug: true, // Optional: Enable console logs (default: false)
});

await client.connect(); // Authenticates + starts polling

// List events
const events = await client.listEvents(
  "2026-02-11T00:00:00Z",
  "2026-02-12T00:00:00Z",
);
console.log(events.data);

// Create event
const result = await client.createEvent({
  subject: "Team Meeting",
  start: "2026-02-17T09:00:00Z",
  end: "2026-02-17T10:00:00Z",
  location: "Zoom",
});

// Update event
await client.updateEvent({ id: "event-123", subject: "Updated Meeting" });

// Delete event
await client.deleteEvent("event-123");

// Health check
await client.healthCheck();

// Concurrent requests work seamlessly
const [health, list] = await Promise.all([
  client.healthCheck(),
  client.listEvents("2026-02-01T00:00:00Z", "2026-02-28T00:00:00Z"),
]);

await client.disconnect();
```

## API Reference

### `new CalendarEmailClient(config?)`

| Option                | Type      | Default                                 | Description                        |
| --------------------- | --------- | --------------------------------------- | ---------------------------------- |
| `senderEmail`         | `string`  | `abdatta1998@gmail.com`                 | Gmail address to send from         |
| `recipientEmail`      | `string`  | `abhishek.datta.2027@anderson.ucla.edu` | Address to send requests to        |
| `responseSenderEmail` | `string`  | `abhishek.datta.2027@anderson.ucla.edu` | Address that sends response emails |
| `credentials`         | `object`  | **Required**                            | Google OAuth credentials object    |
| `tokenPath`           | `string`  | `token.json`                            | Path to store/load OAuth tokens    |
| `debug`               | `boolean` | `false`                                 | Enable console logging             |
| `pollIntervalMs`      | `number`  | `3000`                                  | Inbox polling interval (ms)        |
| `requestTimeoutMs`    | `number`  | `60000`                                 | Request timeout (ms)               |

### Methods

| Method                   | Email Subject               | Description                           |
| ------------------------ | --------------------------- | ------------------------------------- |
| `connect()`              | —                           | Authenticate and start polling        |
| `disconnect()`           | —                           | Stop polling, cancel pending requests |
| `listEvents(start, end)` | `#calendarapi GET list`     | Fetch events in date range            |
| `createEvent(data)`      | `#calendarapi POST create`  | Create a new event                    |
| `updateEvent(data)`      | `#calendarapi PATCH update` | Update an existing event              |
| `deleteEvent(eventId)`   | `#calendarapi DELETE event` | Delete an event                       |
| `healthCheck()`          | `#calendarapi GET health`   | Verify API pipeline is working        |

### Properties

| Property            | Type      | Description                     |
| ------------------- | --------- | ------------------------------- |
| `isConnected`       | `boolean` | Whether the client is connected |
| `pendingRequests`   | `number`  | Count of pending requests       |
| `completedRequests` | `number`  | Count of completed requests     |

## Email Protocol

**Subject format:** `#calendarapi <METHOD> <ACTION>`

**Body:** JSON with auto-generated `requestId`

**Response matching:** Primary key = `requestId`, secondary = `threadId`

## Error Handling & Response Structure

All public API methods (e.g., `listEvents`, `createEvent`) dependably return a JSON `ApiResponse` object, even in case of failure. The client **does not throw** exceptions for API failures (unless critical setup issues occur outside the request flow).

### Success Response

```json
{
  "status": "success",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "data": { ... },
  "durationMs": 1420
}
```

### Error Response

```json
{
  "status": "error",
  "error": "Request timed out after 60000ms",
  "data": { "code": "TIMEOUT" },
  "durationMs": 60005
}
```

### Example Usage

```typescript
const response = await client.listEvents(start, end);

console.log(`Call took ${response.durationMs}ms`);

if (response.status === "error") {
  // Gracefully handle the error
  console.error("Failed to fetch events:", response.error);

  if (response.data?.code === "TIMEOUT") {
    // Handle timeout specifically
  }
} else {
  // Process data
  console.log(response.data);
}
```

## Development

```bash
npm run build     # Compile TypeScript
npm run dev       # Watch mode
npm run lint      # Type-check without emit
```

> [!NOTE]
> **Tests**: Unit tests are not yet included. A test suite (using Vitest with mocked Gmail API) is planned for a future iteration.

## License

MIT

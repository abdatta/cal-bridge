# CalBridge (cal-bridge)

**CalBridge** — a TypeScript client library that bridges calendar systems through an **email-based API protocol**. A nudge towards California (UCLA) and the idea of a Calendar Bridging library. It authenticates via Gmail OAuth, sends structured request emails, polls for JSON responses, and exposes clean async functions — abstracting away all email mechanics.

## How It Works

```
Application Code → CalendarEmailClient → Gmail OAuth → Send Email → Power Automate → Calendar
                                                                     ↓
                   Return parsed result ← Match requestId ← Parse JSON ← Receive Reply Email
```

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

Create a `.env` file in your project root (see `.env.example`):

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_PROJECT_ID=your-project-id
```

Or, place a `credentials.json` from Google Cloud Console directly in the project root.

### 5. Usage

```typescript
import { CalendarEmailClient } from "cal-bridge";

const client = new CalendarEmailClient();

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

| Option                | Type     | Default                                 | Description                        |
| --------------------- | -------- | --------------------------------------- | ---------------------------------- |
| `senderEmail`         | `string` | `abdatta1998@gmail.com`                 | Gmail address to send from         |
| `recipientEmail`      | `string` | `abhishek.datta.2027@anderson.ucla.edu` | Address to send requests to        |
| `responseSenderEmail` | `string` | `abhishek.datta.2027@anderson.ucla.edu` | Address that sends response emails |
| `credentialsPath`     | `string` | `credentials.json`                      | Path to Google OAuth credentials   |
| `tokenPath`           | `string` | `token.json`                            | Path to store/load OAuth tokens    |
| `pollIntervalMs`      | `number` | `3000`                                  | Inbox polling interval (ms)        |
| `requestTimeoutMs`    | `number` | `60000`                                 | Request timeout (ms)               |

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

## Error Handling

```typescript
import { CalendarApiError, ErrorCodes } from "cal-bridge";

try {
  await client.listEvents(start, end);
} catch (error) {
  if (error instanceof CalendarApiError) {
    switch (error.code) {
      case ErrorCodes.TIMEOUT:
        console.log("Request timed out");
        break;
      case ErrorCodes.AUTH_FAILED:
        console.log("Authentication failed");
        break;
      case ErrorCodes.SEND_FAILED:
        console.log("Failed to send email");
        break;
      case ErrorCodes.INVALID_RESPONSE:
        console.log("Invalid response received");
        break;
    }
  }
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

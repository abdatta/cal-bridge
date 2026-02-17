// ============================================================
// Example: Basic Usage of CalBridge
// ============================================================
//
// Prerequisites:
// 1. Create a .env file in the project root with:
//      GOOGLE_CLIENT_ID=your-client-id
//      GOOGLE_CLIENT_SECRET=your-client-secret
//      GOOGLE_PROJECT_ID=your-project-id
// 2. npm install && npm run build
// 3. npx tsx examples/basic-usage.ts
//
// On first run, a browser will open for Gmail authorization.
// After that, tokens are cached in token.json.
// ============================================================

import "dotenv/config";
import * as fs from "fs/promises";
import * as path from "path";
import { CalendarEmailClient, CalendarApiError } from "../dist/index.js";

/**
 * Load credentials from credentials.json or environment variables.
 */
async function getCredentials(): Promise<any> {
  const credentialsPath = path.resolve("credentials.json");

  // 1. Try to read from credentials.json
  try {
    const content = await fs.readFile(credentialsPath, "utf-8");
    const json = JSON.parse(content);
    return json.installed || json.web;
  } catch {
    // Ignore error, try env vars
  }

  // 2. Try environment variables
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3847/oauth2callback";

  if (clientId && clientSecret) {
    return {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [redirectUri],
    };
  }

  console.error("❌ Missing Google OAuth credentials.");
  console.error(
    "   Please provide a credentials.json file OR set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
  );
  process.exit(1);
}

async function main() {
  const credentials = await getCredentials();

  // Create client (uses defaults from config.ts)
  const client = new CalendarEmailClient({
    credentials,
  });

  try {
    // Step 1: Connect (authenticate + start polling)
    // console.log("🔗 Connecting to CalBridge...");
    await client.connect();
    // console.log("✅ Connected!\n");

    // Step 2: Health check
    // console.log("💓 Running health check...");
    const health = await client.healthCheck();
    // console.log("Health check result:", JSON.stringify(health, null, 2));
    // console.log("");

    // Step 3: List events
    // console.log("📋 Listing events for TODAY (2026-02-16)...");
    const events = await client.listEvents(
      "2026-02-16T00:00:00Z",
      "2026-02-16T23:59:59Z",
    );
    console.log(JSON.stringify(events, null, 2));
    // console.log("Events:", JSON.stringify(events, null, 2));
    // console.log("");

    /*
    // Step 4: Create an event
    // console.log("➕ Creating event...");
    const created = await client.createEvent({
      subject: "Team Standup",
      start: "2026-02-17T09:00:00Z",
      end: "2026-02-17T09:30:00Z",
      location: "Zoom",
      body: "Daily team sync",
    });
    // console.log("Created:", JSON.stringify(created, null, 2));
    // console.log("");

    // Step 5: Update the event
    if (
      created.data &&
      typeof created.data === "object" &&
      "id" in (created.data as any)
    ) {
      const eventId = (created.data as any).id;
      // console.log("✏️ Updating event...");
      const updated = await client.updateEvent({
        id: eventId,
        subject: "Team Standup (Updated)",
        location: "Google Meet",
      });
      // console.log("Updated:", JSON.stringify(updated, null, 2));
      // console.log("");

      // Step 6: Delete the event
      // console.log("🗑️ Deleting event...");
      const deleted = await client.deleteEvent(eventId);
      // console.log("Deleted:", JSON.stringify(deleted, null, 2));
      // console.log("");
    }

    // Step 7: Multiple concurrent requests
    // console.log("⚡ Sending concurrent requests...");
    const [healthResult, listResult] = await Promise.all([
      client.healthCheck(),
      client.listEvents("2026-02-01T00:00:00Z", "2026-02-28T00:00:00Z"),
    ]);
    // console.log("Concurrent health:", healthResult.status);
    // console.log("Concurrent list:", JSON.stringify(listResult.data, null, 2));
    */
  } catch (error) {
    if (error instanceof CalendarApiError) {
      console.error(`\n❌ API Error [${error.code}]: ${error.message}`);
      if (error.requestId) {
        console.error(`   Request ID: ${error.requestId}`);
      }
    } else {
      console.error("\n❌ Unexpected error:", error);
    }
  } finally {
    await client.disconnect();
    // console.log("\n👋 Done.");
  }
}

main();

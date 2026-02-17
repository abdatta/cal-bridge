// ============================================================
// Gmail OAuth Authentication Module
// ============================================================

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs/promises";
import * as http from "http";
import { URL } from "url";
import {
  CalendarClientConfig,
  CalendarApiError,
  ErrorCodes,
  GmailClient,
} from "./types.js";

const REDIRECT_PORT = 3847;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

interface TokenData {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/**
 * Handles Gmail OAuth2 authentication.
 *
 * - Loads credentials from a Google Cloud credentials.json file
 * - Performs first-time OAuth consent (opens browser, local callback)
 * - Stores tokens to disk for reuse
 * - Automatically refreshes expired tokens
 */
export class GmailAuth {
  private config: CalendarClientConfig;
  private oauth2Client: OAuth2Client | null = null;
  private gmailClient: GmailClient | null = null;

  constructor(config: CalendarClientConfig) {
    this.config = config;
  }

  /**
   * Authenticate and return an authorized Gmail API client.
   * Reuses stored tokens if available, otherwise triggers OAuth consent flow.
   */
  async authenticate(): Promise<GmailClient> {
    try {
      // Use credentials from config
      const { client_id, client_secret, redirect_uris } =
        this.config.credentials;

      // Use the first redirect URI or a default
      const redirectUri =
        redirect_uris && redirect_uris.length > 0
          ? redirect_uris[0]
          : REDIRECT_URI;

      this.oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirectUri,
      );

      // Try to load existing token
      const existingToken = await this.loadToken();

      if (existingToken) {
        this.oauth2Client.setCredentials(existingToken);

        // Check if token needs refresh
        if (this.isTokenExpired(existingToken)) {
          await this.refreshToken();
        }
      } else {
        // First-time auth: run consent flow
        await this.runConsentFlow();
      }

      // Create Gmail client
      this.gmailClient = google.gmail({
        version: "v1",
        auth: this.oauth2Client,
      });

      return this.gmailClient;
    } catch (error) {
      if (error instanceof CalendarApiError) throw error;
      throw new CalendarApiError(
        `Authentication failed: ${(error as Error).message}`,
        ErrorCodes.AUTH_FAILED,
      );
    }
  }

  /** Get the current Gmail client (must call authenticate() first) */
  getClient(): GmailClient {
    if (!this.gmailClient) {
      throw new CalendarApiError(
        "Not authenticated. Call authenticate() first.",
        ErrorCodes.NOT_CONNECTED,
      );
    }
    return this.gmailClient;
  }

  /** Check if we have a valid, non-expired token */
  isAuthenticated(): boolean {
    if (!this.oauth2Client) return false;
    const creds = this.oauth2Client.credentials;
    return !!creds.access_token && !this.isTokenExpired(creds as TokenData);
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private async loadToken(): Promise<TokenData | null> {
    try {
      const content = await fs.readFile(this.config.tokenPath, "utf-8");
      return JSON.parse(content) as TokenData;
    } catch {
      return null;
    }
  }

  private async saveToken(token: TokenData): Promise<void> {
    await fs.writeFile(this.config.tokenPath, JSON.stringify(token, null, 2));
  }

  private isTokenExpired(token: TokenData | Record<string, unknown>): boolean {
    const expiryDate = token.expiry_date as number | undefined;
    if (!expiryDate) return true;
    // Consider expired if within 5 minutes of expiry
    return Date.now() >= expiryDate - 5 * 60 * 1000;
  }

  private async refreshToken(): Promise<void> {
    if (!this.oauth2Client) return;

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      await this.saveToken(credentials as TokenData);
    } catch {
      // If refresh fails, need full re-auth
      await this.runConsentFlow();
    }
  }

  /**
   * Run the full OAuth consent flow:
   * 1. Generate auth URL
   * 2. Start local HTTP server to receive callback
   * 3. Open browser for user consent
   * 4. Exchange auth code for tokens
   * 5. Save tokens to disk
   */
  private async runConsentFlow(): Promise<void> {
    if (!this.oauth2Client) {
      throw new CalendarApiError(
        "OAuth2 client not initialized",
        ErrorCodes.AUTH_FAILED,
      );
    }

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: this.config.scopes,
      prompt: "consent",
    });

    console.log("\n🔐 Gmail OAuth Authorization Required");
    console.log("━".repeat(50));
    console.log("Open this URL in your browser to authorize:\n");
    console.log(authUrl);
    console.log("\n" + "━".repeat(50));

    // Open browser cross-platform using built-in Node.js
    try {
      const { exec } = await import("child_process");
      const cmd =
        process.platform === "win32"
          ? "start"
          : process.platform === "darwin"
            ? "open"
            : "xdg-open";
      exec(`${cmd} "${authUrl}"`);
      console.log("📎 Browser opened automatically.");
    } catch {
      console.log("📎 Please open the URL above manually.");
    }

    // Wait for callback
    const code = await this.waitForAuthCode();

    // Exchange code for tokens
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    await this.saveToken(tokens as TokenData);

    console.log("✅ Authentication successful! Tokens saved.\n");
  }

  /**
   * Start a temporary local HTTP server to receive the OAuth callback.
   * Returns a promise that resolves with the authorization code.
   */
  private waitForAuthCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (!req.url) {
          res.end("Invalid request");
          return;
        }

        const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            "<h1>Authorization denied</h1><p>You can close this window.</p>",
          );
          server.close();
          reject(
            new CalendarApiError(
              `Authorization denied: ${error}`,
              ErrorCodes.AUTH_FAILED,
            ),
          );
          return;
        }

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<h1>✅ Authorization Successful</h1>" +
              "<p>You can close this window and return to your application.</p>",
          );
          server.close();
          resolve(code);
        } else {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>No authorization code received</h1>");
        }
      });

      server.listen(REDIRECT_PORT, () => {
        console.log(`⏳ Waiting for authorization on port ${REDIRECT_PORT}...`);
      });

      // Timeout after 5 minutes
      setTimeout(
        () => {
          server.close();
          reject(
            new CalendarApiError(
              "Authorization timed out",
              ErrorCodes.AUTH_FAILED,
            ),
          );
        },
        5 * 60 * 1000,
      );
    });
  }
}

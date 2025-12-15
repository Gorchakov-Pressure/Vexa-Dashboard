import { NextResponse } from "next/server";
import https from "https";
import http from "http";

// Force dynamic rendering to avoid Next.js fetch caching issues
export const dynamic = "force-dynamic";

// Helper function to make HTTP/HTTPS requests using native modules
// This bypasses Next.js's patched fetch which has known issues
function httpRequest(
  url: string,
  options: { headers?: Record<string, string>; timeout?: number } = {}
): Promise<{ ok: boolean; status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";
    const transport = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;

    const req = transport.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || defaultPort,
        path: urlObj.pathname + urlObj.search,
        method: "GET",
        headers: options.headers || {},
        timeout: options.timeout || 5000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve({
            ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode || 0,
            data,
          });
        });
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.end();
  });
}

interface HealthStatus {
  status: "ok" | "degraded" | "error";
  authMode: "direct" | "magic-link";
  checks: {
    smtp: { configured: boolean; optional: boolean; error?: string };
    adminApi: { configured: boolean; reachable: boolean; error?: string };
    vexaApi: { configured: boolean; reachable: boolean; error?: string };
  };
  missingConfig: string[];
}

/**
 * Health check endpoint - validates server configuration
 */
export async function GET() {
  const status: HealthStatus = {
    status: "ok",
    authMode: "direct", // Will be updated to "magic-link" if SMTP is configured
    checks: {
      smtp: { configured: false, optional: true },
      adminApi: { configured: false, reachable: false },
      vexaApi: { configured: false, reachable: false },
    },
    missingConfig: [],
  };

  // Check SMTP configuration (optional - enables magic link auth)
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    status.checks.smtp.configured = true;
    status.authMode = "magic-link";
  } else {
    // SMTP is optional - direct login mode will be used
    status.checks.smtp.error = "SMTP not configured - using direct login mode";
    // Don't add SMTP to missingConfig as it's optional
  }

  // Check Admin API configuration
  const adminApiKey = process.env.VEXA_ADMIN_API_KEY;
  const adminApiUrl = process.env.VEXA_ADMIN_API_URL || process.env.VEXA_API_URL;

  if (adminApiKey && adminApiKey !== "your_admin_api_key_here") {
    status.checks.adminApi.configured = true;

    // Test Admin API reachability
    if (adminApiUrl) {
      try {
        const url = `${adminApiUrl}/admin/users?limit=1`;
        const response = await httpRequest(url, {
          headers: { "X-Admin-API-Key": adminApiKey },
          timeout: 10000,
        });

        if (response.ok || response.status === 401) {
          // 401 means API is reachable but key might be wrong
          status.checks.adminApi.reachable = response.ok;
          if (response.status === 401) {
            status.checks.adminApi.error = "Invalid admin API key";
          }
        } else {
          status.checks.adminApi.error = `API returned ${response.status}`;
        }
      } catch (error) {
        const err = error as Error;
        status.checks.adminApi.error = `Cannot reach API: ${err.message || "unknown error"}`;
      }
    }
  } else {
    status.checks.adminApi.error = "Admin API key not configured";
    status.missingConfig.push("VEXA_ADMIN_API_KEY");
  }

  // Check Vexa API configuration
  const vexaApiUrl = process.env.VEXA_API_URL;

  if (vexaApiUrl) {
    status.checks.vexaApi.configured = true;

    // Test Vexa API reachability using /docs endpoint (Vexa API has Swagger docs)
    try {
      const response = await httpRequest(`${vexaApiUrl}/docs`, { timeout: 5000 });
      // Consider any non-5xx response as reachable (200, 301, 404 all mean the server is up)
      status.checks.vexaApi.reachable = response.status < 500;
      if (response.status >= 500) {
        status.checks.vexaApi.error = `API returned ${response.status}`;
      }
    } catch (error) {
      const err = error as Error;
      status.checks.vexaApi.error = `Cannot reach API: ${err.message || "unknown error"}`;
    }
  } else {
    status.checks.vexaApi.error = "Vexa API URL not configured";
    status.missingConfig.push("VEXA_API_URL");
  }

  // Determine overall status
  // Only Admin API is required. SMTP is optional (enables magic-link, otherwise direct login).
  const hasAdminApi = status.checks.adminApi.configured && status.checks.adminApi.reachable;
  const hasVexaApi = status.checks.vexaApi.configured;

  if (!hasAdminApi) {
    // Admin API is required for authentication
    status.status = "error";
  } else if (!hasVexaApi || !status.checks.vexaApi.reachable) {
    // Vexa API is needed for full functionality but not login
    status.status = "degraded";
  }

  return NextResponse.json(status);
}

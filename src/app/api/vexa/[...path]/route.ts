import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

async function proxyRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
): Promise<NextResponse> {
  const VEXA_API_URL = process.env.VEXA_API_URL || "http://localhost:18056";

  // Get user's token from HTTP-only cookie (set during login)
  const cookieStore = await cookies();
  const userToken = cookieStore.get("vexa-token")?.value;

  // Fall back to env variable for backwards compatibility
  const VEXA_API_KEY = userToken || process.env.VEXA_API_KEY || "";

  const { path } = await params;
  const pathString = path.join("/");
  const url = `${VEXA_API_URL}/${pathString}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (VEXA_API_KEY) {
    headers["X-API-Key"] = VEXA_API_KEY;
  }

  try {
    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (method !== "GET" && method !== "HEAD") {
      const body = await request.text();
      if (body) {
        fetchOptions.body = body;
      }
    }

    const response = await fetch(url, fetchOptions);

    // Handle empty responses
    const contentType = response.headers.get("content-type") || "";
    if (response.status === 204) {
      return new NextResponse(null, { status: response.status });
    }

    // Prefer JSON passthrough when possible, but do not drop non-JSON error bodies
    const text = await response.text();
    if (contentType.includes("application/json") && text) {
      try {
        const data = JSON.parse(text);
        return NextResponse.json(data, { status: response.status });
      } catch {
        // fall through to plain text passthrough
      }
    }

    // If upstream sent non-JSON (or invalid JSON), pass through raw text and content-type
    return new NextResponse(text || null, {
      status: response.status,
      headers: {
        "Content-Type": contentType || "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error(`Proxy error for ${method} ${url}:`, error);
    return NextResponse.json(
      { error: "Failed to connect to Vexa API", details: (error as Error).message },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, "POST");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, "PUT");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, "DELETE");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, params, "PATCH");
}

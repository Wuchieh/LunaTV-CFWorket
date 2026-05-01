import { NextRequest, NextResponse } from "next/server";

import { getAuthInfoFromCookie } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipAuth(pathname)) {
    return NextResponse.next();
  }

  if (!process.env.PASSWORD) {
    const warningUrl = new URL("/warning", request.url);
    return NextResponse.redirect(warningUrl);
  }

  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo) {
    return handleAuthFailure(request, pathname);
  }

  const storageType = (process.env.STORAGE_TYPE || "localstorage") as string;

  if (storageType === "localstorage") {
    if (!authInfo.password || authInfo.password !== process.env.PASSWORD) {
      return handleAuthFailure(request, pathname);
    }
    return NextResponse.next();
  }

  if (!authInfo.username || !authInfo.signature) {
    return handleAuthFailure(request, pathname);
  }

  if (authInfo.signature) {
    const isValidSignature = await verifySignature(
      authInfo.username,
      authInfo.signature,
      process.env.PASSWORD || ""
    );

    if (isValidSignature) {
      return NextResponse.next();
    }
  }

  return handleAuthFailure(request, pathname);
}

async function verifySignature(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBuffer = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      messageData
    );
  } catch {
    return false;
  }
}

function handleAuthFailure(
  request: NextRequest,
  pathname: string
): NextResponse {
  if (pathname.startsWith("/api")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  const fullUrl = `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("redirect", fullUrl);
  return NextResponse.redirect(loginUrl);
}

function shouldSkipAuth(pathname: string): boolean {
  const skipPaths = [
    "/_next",
    "/favicon.ico",
    "/robots.txt",
    "/manifest.json",
    "/icons/",
    "/logo.png",
    "/screenshot.png",
  ];

  return skipPaths.some((path) => pathname.startsWith(path));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|warning|api/login|api/register|api/logout|api/cron|api/server-config).*)",
  ],
};

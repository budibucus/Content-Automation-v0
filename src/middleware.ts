import { NextRequest, NextResponse } from "next/server";

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": "Basic" },
  });
}

export function middleware(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return unauthorized();
  }

  const [scheme, encoded] = authorization.split(" ");

  if (scheme !== "Basic" || !encoded) {
    return unauthorized();
  }

  const decoded = atob(encoded);
  const separatorIndex = decoded.indexOf(":");
  const user = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (
    user !== process.env.ADMIN_USER ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export function middleware(request) {
  const response = NextResponse.next();
  const existing = request.cookies.get("uid");
  if (!existing) {
    response.cookies.set("uid", randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });
  }
  return response;
}

export const config = {
  matcher: ["/:path*"]
};

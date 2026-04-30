import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logoutUser, sessionCookieName } from "@/lib/auth";

export async function POST() {
  const token = cookies().get(sessionCookieName)?.value;

  if (token) {
    await logoutUser(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
}

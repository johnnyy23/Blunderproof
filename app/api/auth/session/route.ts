import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserFromSessionToken, sessionCookieName } from "@/lib/auth";

export async function GET() {
  const token = cookies().get(sessionCookieName)?.value;
  const user = await getUserFromSessionToken(token);

  return NextResponse.json({ user });
}

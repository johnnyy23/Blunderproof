import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { changeUserPassword, sessionCookieName } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const token = cookies().get(sessionCookieName)?.value;
    const body = (await request.json()) as { currentPassword?: string; nextPassword?: string };
    await changeUserPassword(token, body.currentPassword ?? "", body.nextPassword ?? "");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not change password." }, { status: 400 });
  }
}

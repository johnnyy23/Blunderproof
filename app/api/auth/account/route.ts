import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCookieName, updateUserProfile } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    const token = cookies().get(sessionCookieName)?.value;
    const body = (await request.json()) as { name?: string; email?: string };
    const user = await updateUserProfile(token, body.name ?? "", body.email ?? "");

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update account." }, { status: 400 });
  }
}

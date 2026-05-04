import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSessionToken, sessionCookieName } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const token = cookies().get(sessionCookieName)?.value;
    const user = await getUserFromSessionToken(token);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const url = new URL(request.url);
    const courseId = url.searchParams.get("course_id")?.trim();

    let query = supabaseAdmin.from("user_progress").select("*").eq("user_id", user.id);

    if (courseId) {
      query = query.eq("course_id", courseId);
    }

    const { data, error } = await query.order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ progress: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not fetch progress."
      },
      { status: 500 }
    );
  }
}

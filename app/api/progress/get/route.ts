import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSessionToken, sessionCookieName } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const shouldDebug = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV !== "production";
function debugLog(...args: unknown[]) {
  if (shouldDebug) {
    // eslint-disable-next-line no-console
    console.log("[progress/get]", ...args);
  }
}
// TODO(v1-launch): Remove preview/dev debug logs once progress is stable in production.

export async function GET(request: Request) {
  try {
    debugLog("start");
    const token = cookies().get(sessionCookieName)?.value;
    const user = await getUserFromSessionToken(token);

    if (!user) {
      debugLog("unauthenticated");
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const url = new URL(request.url);
    const courseId = url.searchParams.get("course_id")?.trim();

    debugLog("query", { userId: user.id, courseId: courseId ?? null });
    let query = supabaseAdmin.from("user_progress").select("*").eq("user_id", user.id);

    if (courseId) {
      query = query.eq("course_id", courseId);
    }

    const { data, error } = await query.order("updated_at", { ascending: false });

    if (error) {
      debugLog("supabase error", { message: error.message, details: error.details, hint: error.hint, code: error.code });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    debugLog("supabase ok", { rowCount: data?.length ?? 0 });
    return NextResponse.json({ progress: data ?? [] });
  } catch (error) {
    debugLog("exception", error instanceof Error ? { message: error.message, stack: error.stack } : error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not fetch progress."
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSessionToken, sessionCookieName } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const shouldDebug = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV !== "production";
function debugLog(...args: unknown[]) {
  if (shouldDebug) {
    // eslint-disable-next-line no-console
    console.log("[progress/save]", ...args);
  }
}
// TODO(v1-launch): Remove preview/dev debug logs once progress is stable in production.

type SaveProgressBody = {
  course_id?: string;
  line_id?: string;
  status?: string;
  last_position_fen?: string | null;
  last_move_index?: number | null;
  completed_reps?: number | null;
  mistake_count?: number | null;
};

export async function POST(request: Request) {
  try {
    debugLog("start");
    const token = cookies().get(sessionCookieName)?.value;
    const user = await getUserFromSessionToken(token);

    if (!user) {
      debugLog("unauthenticated");
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const body = (await request.json()) as SaveProgressBody;
    const course_id = body.course_id?.trim();
    const line_id = body.line_id?.trim();
    const status = body.status?.trim();

    if (!course_id) {
      debugLog("invalid body: missing course_id", { userId: user.id });
      return NextResponse.json({ error: "course_id is required." }, { status: 400 });
    }

    if (!line_id) {
      debugLog("invalid body: missing line_id", { userId: user.id, course_id });
      return NextResponse.json({ error: "line_id is required." }, { status: 400 });
    }

    if (!status) {
      debugLog("invalid body: missing status", { userId: user.id, course_id, line_id });
      return NextResponse.json({ error: "status is required." }, { status: 400 });
    }

    const payload = {
      user_id: user.id,
      course_id,
      line_id,
      status,
      last_position_fen: body.last_position_fen ?? null,
      last_move_index: body.last_move_index ?? null,
      completed_reps: body.completed_reps ?? null,
      mistake_count: body.mistake_count ?? null,
    };

    debugLog("upsert payload", payload);

    const { data, error } = await supabaseAdmin
      .from("user_progress")
      .upsert(payload, { onConflict: "user_id,course_id,line_id" })
      .select("*")
      .single();

    if (error) {
      debugLog("supabase error", { message: error.message, details: error.details, hint: error.hint, code: error.code });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    debugLog("supabase ok", { id: data?.id, user_id: data?.user_id, course_id: data?.course_id, line_id: data?.line_id });
    return NextResponse.json({ progress: data });
  } catch (error) {
    debugLog("exception", error instanceof Error ? { message: error.message, stack: error.stack } : error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not save progress."
      },
      { status: 500 }
    );
  }
}

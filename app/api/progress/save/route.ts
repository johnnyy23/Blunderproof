import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSessionToken, sessionCookieName } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
    const token = cookies().get(sessionCookieName)?.value;
    const user = await getUserFromSessionToken(token);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const body = (await request.json()) as SaveProgressBody;
    const course_id = body.course_id?.trim();
    const line_id = body.line_id?.trim();
    const status = body.status?.trim();

    if (!course_id) {
      return NextResponse.json({ error: "course_id is required." }, { status: 400 });
    }

    if (!line_id) {
      return NextResponse.json({ error: "line_id is required." }, { status: 400 });
    }

    if (!status) {
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
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from("user_progress")
      .upsert(payload, { onConflict: "user_id,course_id,line_id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ progress: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not save progress."
      },
      { status: 500 }
    );
  }
}

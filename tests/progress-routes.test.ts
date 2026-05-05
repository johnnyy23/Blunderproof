import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => {
  return {
    cookies: () => ({
      get: () => undefined
    })
  };
});

vi.mock("@/lib/auth", () => {
  return {
    sessionCookieName: "blounderproof_session",
    getUserFromSessionToken: vi.fn(async () => null)
  };
});

vi.mock("@/lib/supabase/server", () => {
  const queryBuilder = {
    eq: () => queryBuilder,
    order: async () => ({ data: [], error: null })
  };

  return {
    supabaseAdmin: {
      from: () => ({
        select: () => queryBuilder,
        upsert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: null })
          })
        })
      })
    }
  };
});

describe("progress routes", () => {
  it("GET /api/progress/get returns 401 when unauthenticated", async () => {
    const { GET } = await import("../app/api/progress/get/route");
    const res = await GET(new Request("http://localhost:3000/api/progress/get?course_id=jobava-london"));
    expect(res.status).toBe(401);
  });

  it("POST /api/progress/save returns 401 when unauthenticated", async () => {
    const { POST } = await import("../app/api/progress/save/route");
    const res = await POST(
      new Request("http://localhost:3000/api/progress/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: "jobava-london",
          line_id: "jobava-main-setup",
          status: "idle"
        })
      })
    );
    expect(res.status).toBe(401);
  });

  it("authenticated save/get works (mocked)", async () => {
    const auth = await import("@/lib/auth");
    const getUserFromSessionToken = auth.getUserFromSessionToken as unknown as ReturnType<typeof vi.fn>;

    getUserFromSessionToken.mockResolvedValueOnce({ id: "user-123" });
    const { POST } = await import("../app/api/progress/save/route");

    const saveRes = await POST(
      new Request("http://localhost:3000/api/progress/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: "jobava-london",
          line_id: "jobava-main-setup",
          status: "idle",
          last_move_index: 2
        })
      })
    );
    expect(saveRes.status).toBe(200);

    getUserFromSessionToken.mockResolvedValueOnce({ id: "user-123" });
    const { GET } = await import("../app/api/progress/get/route");
    const getRes = await GET(new Request("http://localhost:3000/api/progress/get?course_id=jobava-london"));
    expect(getRes.status).toBe(200);
  });
});

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCookieName, updateMembership, type BillingCycle, type MembershipPlan } from "@/lib/auth";

export async function PATCH(request: Request) {
  try {
    const token = cookies().get(sessionCookieName)?.value;
    const body = (await request.json()) as { plan?: MembershipPlan; billingEmail?: string; billingCycle?: BillingCycle | null };
    const user = await updateMembership(token, body.plan ?? "free", body.billingEmail ?? "", body.billingCycle ?? null);

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update membership." },
      { status: 400 }
    );
  }
}

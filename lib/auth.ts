import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

import { supabaseAdmin } from "@/lib/supabase/server";

const scrypt = promisify(scryptCallback);

export const sessionCookieName = "blounderproof_session";

export type MembershipPlan = "free" | "pro" | "team";
export type BillingState = "none" | "trial" | "checkout_pending" | "active" | "past_due" | "canceled";
export type BillingCycle = "monthly" | "yearly" | "team";

export type AffiliateAttribution = {
  affiliateId: string;
  referralCode: string;
  referredAt: string;
};

type StoredUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  membershipPlan: MembershipPlan;
  membershipStatus: "active" | "trialing";
  billingEmail: string;
  billingCycle: BillingCycle | null;
  billingState: BillingState;
  trialEndsAt: string | null;
  billingStartedAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  affiliateId: string | null;
  referralCode: string | null;
  referredAt: string | null;
};

type StoredSession = {
  token: string;
  userId: string;
  expiresAt: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  membershipPlan: MembershipPlan;
  membershipStatus: "active" | "trialing";
  billingEmail: string;
  billingCycle: BillingCycle | null;
  billingState: BillingState;
  trialEndsAt: string | null;
  billingStartedAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  affiliateId: string | null;
  referralCode: string | null;
  referredAt: string | null;
};

const usersTable = "app_users";
const sessionsTable = "app_sessions";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createTrialEndsAt(startedAt = Date.now()): string {
  return new Date(startedAt + 1000 * 60 * 60 * 24 * 7).toISOString();
}

function hasActiveTrial(user: Pick<StoredUser, "trialEndsAt">): boolean {
  return Boolean(user.trialEndsAt && new Date(user.trialEndsAt).getTime() > Date.now());
}

function sanitizeUser(user: Partial<StoredUser> & Pick<StoredUser, "id" | "name" | "email" | "passwordHash" | "passwordSalt">): StoredUser {
  const createdAt = typeof user.createdAt === "string" ? user.createdAt : new Date().toISOString();
  const trialEndsAt = typeof user.trialEndsAt === "string" ? user.trialEndsAt : null;
  const hasTrial = trialEndsAt ? new Date(trialEndsAt).getTime() > Date.now() : false;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    passwordSalt: user.passwordSalt,
    createdAt,
    membershipPlan: (user.membershipPlan ?? "free") as MembershipPlan,
    membershipStatus: user.membershipStatus ?? (hasTrial ? "trialing" : "active"),
    billingEmail: user.billingEmail ?? user.email,
    billingCycle: (typeof user.billingCycle === "string" ? user.billingCycle : null) as BillingCycle | null,
    billingState: (user.billingState ?? (hasTrial ? "trial" : "none")) as BillingState,
    trialEndsAt,
    billingStartedAt: typeof user.billingStartedAt === "string" ? user.billingStartedAt : createdAt,
    stripeCustomerId: typeof user.stripeCustomerId === "string" ? user.stripeCustomerId : null,
    stripeSubscriptionId: typeof user.stripeSubscriptionId === "string" ? user.stripeSubscriptionId : null,
    affiliateId: typeof user.affiliateId === "string" ? user.affiliateId : null,
    referralCode: typeof user.referralCode === "string" ? user.referralCode : null,
    referredAt: typeof user.referredAt === "string" ? user.referredAt : null
  };
}

function toPublicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    membershipPlan: user.membershipPlan,
    membershipStatus: user.membershipStatus,
    billingEmail: user.billingEmail,
    billingCycle: user.billingCycle,
    billingState: user.billingState,
    trialEndsAt: user.trialEndsAt,
    billingStartedAt: user.billingStartedAt,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    affiliateId: user.affiliateId,
    referralCode: user.referralCode,
    referredAt: user.referredAt
  };
}

async function hashPassword(password: string, salt = randomBytes(16).toString("hex")): Promise<{ salt: string; hash: string }> {
  const derived = (await scrypt(password, salt, 64)) as Buffer;

  return {
    salt,
    hash: derived.toString("hex")
  };
}

async function verifyPassword(password: string, user: StoredUser): Promise<boolean> {
  const derived = (await scrypt(password, user.passwordSalt, 64)) as Buffer;
  const stored = Buffer.from(user.passwordHash, "hex");

  if (derived.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(derived, stored);
}

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  return null;
}

function rowToStoredUser(row: any): StoredUser {
  return sanitizeUser({
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    createdAt: row.created_at,
    membershipPlan: row.membership_plan,
    membershipStatus: row.membership_status,
    billingEmail: row.billing_email,
    billingCycle: row.billing_cycle,
    billingState: row.billing_state,
    trialEndsAt: row.trial_ends_at,
    billingStartedAt: row.billing_started_at,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    affiliateId: row.affiliate_id,
    referralCode: row.referral_code,
    referredAt: row.referred_at
  });
}

function userToRow(user: Partial<StoredUser>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (typeof user.name !== "undefined") row.name = user.name;
  if (typeof user.email !== "undefined") row.email = user.email;
  if (typeof user.passwordHash !== "undefined") row.password_hash = user.passwordHash;
  if (typeof user.passwordSalt !== "undefined") row.password_salt = user.passwordSalt;
  if (typeof user.createdAt !== "undefined") row.created_at = user.createdAt;
  if (typeof user.membershipPlan !== "undefined") row.membership_plan = user.membershipPlan;
  if (typeof user.membershipStatus !== "undefined") row.membership_status = user.membershipStatus;
  if (typeof user.billingEmail !== "undefined") row.billing_email = user.billingEmail;
  if (typeof user.billingCycle !== "undefined") row.billing_cycle = user.billingCycle;
  if (typeof user.billingState !== "undefined") row.billing_state = user.billingState;
  if (typeof user.trialEndsAt !== "undefined") row.trial_ends_at = user.trialEndsAt;
  if (typeof user.billingStartedAt !== "undefined") row.billing_started_at = user.billingStartedAt;
  if (typeof user.stripeCustomerId !== "undefined") row.stripe_customer_id = user.stripeCustomerId;
  if (typeof user.stripeSubscriptionId !== "undefined") row.stripe_subscription_id = user.stripeSubscriptionId;
  if (typeof user.affiliateId !== "undefined") row.affiliate_id = user.affiliateId;
  if (typeof user.referralCode !== "undefined") row.referral_code = user.referralCode;
  if (typeof user.referredAt !== "undefined") row.referred_at = user.referredAt;

  return row;
}

async function fetchUserById(userId: string): Promise<StoredUser | null> {
  const { data, error } = await supabaseAdmin.from(usersTable).select("*").eq("id", userId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? rowToStoredUser(data) : null;
}

async function fetchUserByEmail(email: string): Promise<StoredUser | null> {
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabaseAdmin.from(usersTable).select("*").eq("email", normalizedEmail).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? rowToStoredUser(data) : null;
}

async function requireSession(token: string | undefined): Promise<StoredSession> {
  if (!token) {
    throw new Error("You need to sign in first.");
  }

  const { data, error } = await supabaseAdmin
    .from(sessionsTable)
    .select("token,user_id,expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const expiresAt = new Date(data.expires_at as string).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    // Best-effort cleanup.
    await supabaseAdmin.from(sessionsTable).delete().eq("token", token);
    throw new Error("Your session has expired. Please sign in again.");
  }

  return {
    token: data.token as string,
    userId: data.user_id as string,
    expiresAt: data.expires_at as string
  };
}

async function setSession(userId: string): Promise<StoredSession> {
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  const { error } = await supabaseAdmin.from(sessionsTable).insert({
    token,
    user_id: userId,
    expires_at: expiresAt
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    token,
    userId,
    expiresAt
  };
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  attribution?: AffiliateAttribution | null
): Promise<{ user: AuthUser; token: string }> {
  const normalizedEmail = normalizeEmail(email);
  const passwordError = validatePassword(password);

  if (!name.trim()) {
    throw new Error("Name is required.");
  }

  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  if (passwordError) {
    throw new Error(passwordError);
  }

  const existing = await fetchUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error("An account with that email already exists.");
  }

  const hashed = await hashPassword(password);
  const userId = randomBytes(12).toString("hex");
  const nowIso = new Date().toISOString();

  const insertRow = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    password_hash: hashed.hash,
    password_salt: hashed.salt,
    created_at: nowIso,
    membership_plan: "free",
    membership_status: "trialing",
    billing_email: normalizedEmail,
    billing_cycle: null,
    billing_state: "trial",
    trial_ends_at: createTrialEndsAt(),
    billing_started_at: nowIso,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    affiliate_id: attribution?.affiliateId ?? null,
    referral_code: attribution?.referralCode ?? null,
    referred_at: attribution?.referredAt ?? null
  };

  const { data, error } = await supabaseAdmin.from(usersTable).insert(insertRow).select("*").single();
  if (error) {
    // Covers unique constraint races.
    if (error.message.toLowerCase().includes("duplicate") || error.code === "23505") {
      throw new Error("An account with that email already exists.");
    }
    throw new Error(error.message);
  }

  const session = await setSession(userId);
  return { user: toPublicUser(rowToStoredUser(data)), token: session.token };
}

export async function loginUser(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  const normalizedEmail = normalizeEmail(email);
  const user = await fetchUserByEmail(normalizedEmail);

  if (!user || !(await verifyPassword(password, user))) {
    throw new Error("Email or password is incorrect.");
  }

  const session = await setSession(user.id);
  return { user: toPublicUser(user), token: session.token };
}

export async function logoutUser(token: string): Promise<void> {
  const { error } = await supabaseAdmin.from(sessionsTable).delete().eq("token", token);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getUserFromSessionToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from(sessionsTable)
    .select("user_id,expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const expiresAt = new Date(data.expires_at as string).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await supabaseAdmin.from(sessionsTable).delete().eq("token", token);
    return null;
  }

  const user = await fetchUserById(data.user_id as string);
  return user ? toPublicUser(user) : null;
}

export async function updateUserProfile(token: string | undefined, name: string, email: string): Promise<AuthUser> {
  const normalizedEmail = normalizeEmail(email);

  if (!token) {
    throw new Error("You need to sign in first.");
  }

  if (!name.trim()) {
    throw new Error("Name is required.");
  }

  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  const session = await requireSession(token);
  const user = await fetchUserById(session.userId);

  if (!user) {
    throw new Error("Account not found.");
  }

  const { data: conflict } = await supabaseAdmin
    .from(usersTable)
    .select("id")
    .eq("email", normalizedEmail)
    .neq("id", user.id)
    .maybeSingle();

  if (conflict?.id) {
    throw new Error("Another account already uses that email.");
  }

  const updateRow = userToRow({
    name: name.trim(),
    email: normalizedEmail,
    billingEmail: user.billingEmail || normalizedEmail
  });

  const { data, error } = await supabaseAdmin.from(usersTable).update(updateRow).eq("id", user.id).select("*").single();
  if (error) {
    throw new Error(error.message);
  }

  return toPublicUser(rowToStoredUser(data));
}

export async function changeUserPassword(token: string | undefined, currentPassword: string, nextPassword: string): Promise<void> {
  if (!token) {
    throw new Error("You need to sign in first.");
  }

  const passwordError = validatePassword(nextPassword);

  if (passwordError) {
    throw new Error(passwordError);
  }

  const session = await requireSession(token);
  const user = await fetchUserById(session.userId);

  if (!user) {
    throw new Error("Account not found.");
  }

  if (!(await verifyPassword(currentPassword, user))) {
    throw new Error("Current password is incorrect.");
  }

  const hashed = await hashPassword(nextPassword);
  const { error } = await supabaseAdmin
    .from(usersTable)
    .update({ password_hash: hashed.hash, password_salt: hashed.salt })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateMembership(
  token: string | undefined,
  plan: MembershipPlan,
  billingEmail: string,
  billingCycle?: BillingCycle | null
): Promise<AuthUser> {
  const normalizedEmail = normalizeEmail(billingEmail);

  if (!token) {
    throw new Error("You need to sign in first.");
  }

  if (!["free", "pro", "team"].includes(plan)) {
    throw new Error("Choose a valid plan.");
  }

  if (!normalizedEmail) {
    throw new Error("Billing email is required.");
  }

  const session = await requireSession(token);
  const user = await fetchUserById(session.userId);

  if (!user) {
    throw new Error("Account not found.");
  }

  const next: Partial<StoredUser> = {
    membershipPlan: plan,
    billingEmail: normalizedEmail,
    billingCycle: (typeof billingCycle !== "undefined" ? billingCycle : user.billingCycle) ?? null,
    billingStartedAt: user.billingStartedAt ?? new Date().toISOString()
  };

  if (plan === "free") {
    next.billingCycle = null;
    next.billingState = hasActiveTrial(user) ? "trial" : "none";
    next.membershipStatus = hasActiveTrial(user) ? "trialing" : "active";
  } else {
    next.billingState = user.stripeSubscriptionId ? "active" : "checkout_pending";
    next.membershipStatus = hasActiveTrial(user) ? "trialing" : "active";
  }

  const { data, error } = await supabaseAdmin.from(usersTable).update(userToRow(next)).eq("id", user.id).select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  return toPublicUser(rowToStoredUser(data));
}

type StripeCheckoutUpdate = {
  billingEmail?: string;
  billingCycle?: BillingCycle | null;
  membershipPlan?: MembershipPlan;
  billingState?: BillingState;
  membershipStatus?: "active" | "trialing";
  billingStartedAt?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  trialEndsAt?: string | null;
};

export async function updateStripeCheckoutForUser(userId: string, update: StripeCheckoutUpdate): Promise<AuthUser> {
  const user = await fetchUserById(userId);

  if (!user) {
    throw new Error("Account not found.");
  }

  const next: Partial<StoredUser> = {};

  if (typeof update.membershipPlan !== "undefined") next.membershipPlan = update.membershipPlan;
  if (typeof update.billingEmail === "string" && update.billingEmail.trim()) next.billingEmail = normalizeEmail(update.billingEmail);
  if (typeof update.billingCycle !== "undefined") next.billingCycle = update.billingCycle;
  if (typeof update.billingState !== "undefined") next.billingState = update.billingState;
  if (typeof update.membershipStatus !== "undefined") next.membershipStatus = update.membershipStatus;
  if (typeof update.billingStartedAt !== "undefined") next.billingStartedAt = update.billingStartedAt;
  if (typeof update.stripeCustomerId !== "undefined") next.stripeCustomerId = update.stripeCustomerId;
  if (typeof update.stripeSubscriptionId !== "undefined") next.stripeSubscriptionId = update.stripeSubscriptionId;
  if (typeof update.trialEndsAt !== "undefined") next.trialEndsAt = update.trialEndsAt;

  const { data, error } = await supabaseAdmin.from(usersTable).update(userToRow(next)).eq("id", userId).select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  return toPublicUser(rowToStoredUser(data));
}

function isoFromUnixSeconds(value: number | null | undefined): string | null {
  if (!value || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

function billingStateFromStripeStatus(status: string | null | undefined): BillingState {
  if (status === "trialing") return "trial";
  if (status === "active") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "checkout_pending";
}

export type StripeSubscriptionSnapshot = {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd?: boolean | null;
  trialEndUnix?: number | null;
  currentPeriodEndUnix?: number | null;
  membershipPlan?: MembershipPlan;
  billingCycle?: BillingCycle | null;
  billingEmail?: string | null;
};

export async function applyStripeSubscriptionSnapshot(userId: string, snapshot: StripeSubscriptionSnapshot): Promise<AuthUser> {
  const user = await fetchUserById(userId);

  if (!user) {
    throw new Error("Account not found.");
  }

  const next: Partial<StoredUser> = {};

  if (typeof snapshot.membershipPlan !== "undefined" && snapshot.membershipPlan) {
    next.membershipPlan = snapshot.membershipPlan;
  }

  if (typeof snapshot.billingCycle !== "undefined") {
    next.billingCycle = snapshot.billingCycle;
  }

  if (typeof snapshot.billingEmail === "string" && snapshot.billingEmail.trim()) {
    next.billingEmail = normalizeEmail(snapshot.billingEmail);
  }

  next.stripeCustomerId = snapshot.stripeCustomerId;
  next.stripeSubscriptionId = snapshot.stripeSubscriptionId;

  const trialEndsAt = isoFromUnixSeconds(snapshot.trialEndUnix ?? null);
  if (trialEndsAt) {
    next.trialEndsAt = trialEndsAt;
  }

  next.billingStartedAt = user.billingStartedAt ?? new Date().toISOString();

  const derivedBillingState = billingStateFromStripeStatus(snapshot.subscriptionStatus);
  next.billingState = derivedBillingState;

  const hasTrial = hasActiveTrial({ trialEndsAt: next.trialEndsAt ?? user.trialEndsAt });
  next.membershipStatus = derivedBillingState === "trial" || hasTrial ? "trialing" : "active";

  const { data, error } = await supabaseAdmin.from(usersTable).update(userToRow(next)).eq("id", userId).select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  return toPublicUser(rowToStoredUser(data));
}

export type UserAffiliateStatsRecord = {
  id: string;
  email: string;
  createdAt: string;
  affiliateId: string | null;
  referralCode: string | null;
  referredAt: string | null;
};

export async function listUsersForAffiliateStats(): Promise<UserAffiliateStatsRecord[]> {
  const { data, error } = await supabaseAdmin
    .from(usersTable)
    .select("id,email,created_at,affiliate_id,referral_code,referred_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
    affiliateId: row.affiliate_id ?? null,
    referralCode: row.referral_code ?? null,
    referredAt: row.referred_at ?? null
  }));
}
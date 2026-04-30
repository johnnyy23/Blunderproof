import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { promisify } from "util";

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

type AuthStore = {
  users: StoredUser[];
  sessions: StoredSession[];
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

const authStorePath = path.join(process.cwd(), "data", "auth-store.json");

async function ensureAuthStore(): Promise<void> {
  await mkdir(path.dirname(authStorePath), { recursive: true });

  try {
    await readFile(authStorePath, "utf8");
  } catch {
    await writeFile(authStorePath, JSON.stringify({ users: [], sessions: [] }, null, 2), "utf8");
  }
}

async function readAuthStore(): Promise<AuthStore> {
  await ensureAuthStore();
  const raw = await readFile(authStorePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<AuthStore>;

  return {
    users: Array.isArray(parsed.users) ? parsed.users.map((user) => sanitizeUser(user as StoredUser)) : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
  };
}

async function writeAuthStore(store: AuthStore): Promise<void> {
  await ensureAuthStore();
  await writeFile(authStorePath, JSON.stringify(store, null, 2), "utf8");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeUser(user: StoredUser): StoredUser {
  const trialEndsAt = typeof user.trialEndsAt === "string" ? user.trialEndsAt : null;
  const hasActiveTrial = trialEndsAt ? new Date(trialEndsAt).getTime() > Date.now() : false;

  return {
    ...user,
    membershipPlan: user.membershipPlan ?? "free",
    membershipStatus: user.membershipStatus ?? (hasActiveTrial ? "trialing" : "active"),
    billingEmail: user.billingEmail ?? user.email,
    billingCycle: user.billingCycle ?? null,
    billingState: user.billingState ?? (hasActiveTrial ? "trial" : "none"),
    trialEndsAt,
    billingStartedAt: typeof user.billingStartedAt === "string" ? user.billingStartedAt : user.createdAt ?? new Date().toISOString(),
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

function createTrialEndsAt(startedAt = Date.now()): string {
  return new Date(startedAt + 1000 * 60 * 60 * 24 * 7).toISOString();
}

function hasActiveTrial(user: Pick<StoredUser, "trialEndsAt">): boolean {
  return Boolean(user.trialEndsAt && new Date(user.trialEndsAt).getTime() > Date.now());
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

export async function registerUser(name: string, email: string, password: string, attribution?: AffiliateAttribution | null): Promise<{ user: AuthUser; token: string }> {
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

  const store = await readAuthStore();

  if (store.users.some((user) => user.email === normalizedEmail)) {
    throw new Error("An account with that email already exists.");
  }

  const hashed = await hashPassword(password);
  const user: StoredUser = {
    id: randomBytes(12).toString("hex"),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashed.hash,
    passwordSalt: hashed.salt,
    createdAt: new Date().toISOString(),
    membershipPlan: "free",
    membershipStatus: "trialing",
    billingEmail: normalizedEmail,
    billingCycle: null,
    billingState: "trial",
    trialEndsAt: createTrialEndsAt(),
    billingStartedAt: new Date().toISOString(),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    affiliateId: attribution?.affiliateId ?? null,
    referralCode: attribution?.referralCode ?? null,
    referredAt: attribution?.referredAt ?? null
  };

  const token = randomBytes(24).toString("hex");
  const session: StoredSession = {
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  };

  store.users.push(user);
  store.sessions = store.sessions.filter((entry) => new Date(entry.expiresAt).getTime() > Date.now());
  store.sessions.push(session);
  await writeAuthStore(store);

  return { user: toPublicUser(user), token };
}

export async function loginUser(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  const normalizedEmail = normalizeEmail(email);
  const store = await readAuthStore();
  const user = store.users.find((entry) => entry.email === normalizedEmail);

  if (!user || !(await verifyPassword(password, user))) {
    throw new Error("Email or password is incorrect.");
  }

  const token = randomBytes(24).toString("hex");
  const session: StoredSession = {
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  };

  store.sessions = store.sessions.filter((entry) => new Date(entry.expiresAt).getTime() > Date.now());
  store.sessions.push(session);
  await writeAuthStore(store);

  return { user: toPublicUser(user), token };
}

export async function logoutUser(token: string): Promise<void> {
  const store = await readAuthStore();
  store.sessions = store.sessions.filter((entry) => entry.token !== token);
  await writeAuthStore(store);
}

export async function getUserFromSessionToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  const store = await readAuthStore();
  const session = store.sessions.find((entry) => entry.token === token && new Date(entry.expiresAt).getTime() > Date.now());

  if (!session) {
    return null;
  }

  const user = store.users.find((entry) => entry.id === session.userId);
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

  const store = await readAuthStore();
  const session = store.sessions.find((entry) => entry.token === token && new Date(entry.expiresAt).getTime() > Date.now());

  if (!session) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const user = store.users.find((entry) => entry.id === session.userId);

  if (!user) {
    throw new Error("Account not found.");
  }

  if (store.users.some((entry) => entry.id !== user.id && entry.email === normalizedEmail)) {
    throw new Error("Another account already uses that email.");
  }

  user.name = name.trim();
  user.email = normalizedEmail;
  user.billingEmail = user.billingEmail || normalizedEmail;
  await writeAuthStore(store);

  return toPublicUser(user);
}

export async function changeUserPassword(token: string | undefined, currentPassword: string, nextPassword: string): Promise<void> {
  if (!token) {
    throw new Error("You need to sign in first.");
  }

  const passwordError = validatePassword(nextPassword);

  if (passwordError) {
    throw new Error(passwordError);
  }

  const store = await readAuthStore();
  const session = store.sessions.find((entry) => entry.token === token && new Date(entry.expiresAt).getTime() > Date.now());

  if (!session) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const user = store.users.find((entry) => entry.id === session.userId);

  if (!user) {
    throw new Error("Account not found.");
  }

  if (!(await verifyPassword(currentPassword, user))) {
    throw new Error("Current password is incorrect.");
  }

  const hashed = await hashPassword(nextPassword);
  user.passwordHash = hashed.hash;
  user.passwordSalt = hashed.salt;
  await writeAuthStore(store);
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

  const store = await readAuthStore();
  const session = store.sessions.find((entry) => entry.token === token && new Date(entry.expiresAt).getTime() > Date.now());

  if (!session) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const user = store.users.find((entry) => entry.id === session.userId);

  if (!user) {
    throw new Error("Account not found.");
  }

  user.membershipPlan = plan;
  user.billingEmail = normalizedEmail;
  user.billingCycle = billingCycle ?? user.billingCycle ?? null;
  user.billingStartedAt = user.billingStartedAt ?? new Date().toISOString();

  if (plan === "free") {
    user.billingCycle = null;
    user.billingState = hasActiveTrial(user) ? "trial" : "none";
    user.membershipStatus = hasActiveTrial(user) ? "trialing" : "active";
  } else {
    user.billingState = user.stripeSubscriptionId ? "active" : "checkout_pending";
    user.membershipStatus = hasActiveTrial(user) ? "trialing" : "active";
  }

  await writeAuthStore(store);

  return toPublicUser(user);
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
  const store = await readAuthStore();
  const user = store.users.find((entry) => entry.id === userId);

  if (!user) {
    throw new Error("Account not found.");
  }

  if (typeof update.membershipPlan !== "undefined") {
    user.membershipPlan = update.membershipPlan;
  }

  if (typeof update.billingEmail === "string" && update.billingEmail.trim()) {
    user.billingEmail = normalizeEmail(update.billingEmail);
  }

  if (typeof update.billingCycle !== "undefined") {
    user.billingCycle = update.billingCycle;
  }

  if (typeof update.billingState !== "undefined") {
    user.billingState = update.billingState;
  }

  if (typeof update.membershipStatus !== "undefined") {
    user.membershipStatus = update.membershipStatus;
  }

  if (typeof update.billingStartedAt !== "undefined") {
    user.billingStartedAt = update.billingStartedAt;
  }

  if (typeof update.stripeCustomerId !== "undefined") {
    user.stripeCustomerId = update.stripeCustomerId;
  }

  if (typeof update.stripeSubscriptionId !== "undefined") {
    user.stripeSubscriptionId = update.stripeSubscriptionId;
  }

  if (typeof update.trialEndsAt !== "undefined") {
    user.trialEndsAt = update.trialEndsAt;
  }

  await writeAuthStore(store);
  return toPublicUser(user);
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
  const store = await readAuthStore();

  return store.users.map((user) => ({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    affiliateId: user.affiliateId,
    referralCode: user.referralCode,
    referredAt: user.referredAt
  }));
}

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { User } from "../models/User.js";
import { VolunteerSession } from "../models/VolunteerSession.js";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "fb_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const loginAttempts = new Map();

function readSessionToken(req) {
  const pair = (req.headers.cookie ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return pair ? pair.slice(SESSION_COOKIE.length + 1) : "";
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function setSessionCookie(res, token, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${maxAge}${secure}`);
}

function publicUser(user) {
  return {
    id: String(user._id ?? user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    org: user.org ?? null,
  };
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!/^[a-f0-9]{32}$/i.test(saltHex ?? "") || !/^[a-f0-9]{128}$/i.test(hashHex ?? "")) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

export async function attachUser(req, _res, next) {
  const token = readSessionToken(req);
  if (!token) return next();
  try {
    const session = await VolunteerSession.findOne({
      tokenHash: tokenHash(token),
      expiresAt: { $gt: new Date() },
    }).populate("userId", "name email role org");
    req.user = session?.userId ? publicUser(session.userId) : null;
    return next();
  } catch (error) {
    return next(error);
  }
}

export const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Please sign in to continue" });
  if (req.user.role !== role) return res.status(403).json({ error: `Only ${role}s can do this` });
  return next();
};

export function limitLoginAttempts(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const attempt = loginAttempts.get(key);
  if (attempt && attempt.resetAt > now && attempt.count >= 10) {
    res.set("Retry-After", String(Math.ceil((attempt.resetAt - now) / 1000)));
    return res.status(429).json({ error: "Too many sign-in attempts. Please try again in a little while." });
  }
  if (!attempt || attempt.resetAt <= now) loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
  else attempt.count++;
  if (loginAttempts.size > 1000) {
    for (const [ip, value] of loginAttempts) if (value.resetAt <= now) loginAttempts.delete(ip);
  }
  return next();
}

export async function registerVolunteer(req, res, next) {
  const { name, email, password, org } = req.body ?? {};
  const cleanName = String(name ?? "").trim();
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  const cleanOrg = String(org ?? "").trim();
  if (!cleanName || cleanName.length > 60 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254 ||
      typeof password !== "string" || password.length < 10 || password.length > 128 ||
      cleanOrg.length > 80) {
    return res.status(400).json({ error: "Enter a name, valid email, and password between 10 and 128 characters." });
  }
  try {
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      passwordHash: await hashPassword(password),
      role: "volunteer",
      org: cleanOrg || null,
    });
    return await createSession(res, user, 201);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: "An account with this email already exists. Please sign in instead." });
    return next(error);
  }
}

export async function loginVolunteer(req, res, next) {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 128) {
    return res.status(400).json({ error: "Enter your email address and password." });
  }
  try {
    const user = await User.findOne({ email: email.trim().toLowerCase(), role: "volunteer" });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Email or password doesn’t match. Please try again." });
    }
    return await createSession(res, user);
  } catch (error) {
    return next(error);
  }
}

async function createSession(res, user, status = 200) {
  const token = randomBytes(32).toString("base64url");
  await VolunteerSession.create({
    userId: user._id,
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + SESSION_MS),
  });
  setSessionCookie(res, token, SESSION_MS / 1000);
  return res.status(status).json(publicUser(user));
}

export async function currentVolunteer(req, res) {
  if (req.user?.role !== "volunteer") return res.status(401).json({ error: "Please sign in to continue" });
  return res.json(req.user);
}

export async function logout(req, res, next) {
  const token = readSessionToken(req);
  try {
    if (token) await VolunteerSession.deleteOne({ tokenHash: tokenHash(token) });
    setSessionCookie(res, "", 0);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

import { Router, type Response } from "express";
import type { CookieOptions } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { User } from "../models/User";
import { RefreshToken } from "../models/RefreshToken";
import { PasswordResetToken } from "../models/PasswordResetToken";
import {
  signAccessToken,
  createRefreshToken,
  rotateRefreshToken,
} from "../auth/tokens";
import { validatePasswordStrength } from "../auth/passwordPolicy";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { authRateLimit } from "../middleware/authRateLimit";
import { sendPasswordResetEmail } from "../services/email";
import { isLockedOut, recordFailedAttempt, clearAttempts } from "../services/loginAttempts";
import { logger } from "../lib/logger";

const router = Router();

const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isProduction = process.env.NODE_ENV === "production";

const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  path: "/api/auth",
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie("refreshToken", token, REFRESH_COOKIE_OPTIONS);
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    path: "/api/auth",
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  });
}

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && EMAIL_REGEX.test(email);
}

function isValidPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 8;
}

router.post("/register", authRateLimit, async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  if (typeof password !== "string") {
    res.status(400).json({ error: "Password is required." });
    return;
  }

  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    res.status(400).json({ error: passwordCheck.reason });
    return;
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ email, hashedPassword });

  const userId = user._id.toString();
  const accessToken = signAccessToken(userId);
  const refreshToken = await createRefreshToken(userId);

  setRefreshTokenCookie(res, refreshToken);
  res.status(201).json({
    user: { id: userId, email: user.email },
    accessToken,
  });
});

router.post("/login", authRateLimit, async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email) || typeof password !== "string") {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const lockStatus = isLockedOut(email);
  if (lockStatus.locked) {
    res.status(429).json({
      error: "Too many failed attempts. Try again later.",
      retryAfterMs: lockStatus.retryAfterMs,
    });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    recordFailedAttempt(email);
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.hashedPassword);
  if (!valid) {
    recordFailedAttempt(email);
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  clearAttempts(email);

  const userId = user._id.toString();
  const accessToken = signAccessToken(userId);
  const refreshToken = await createRefreshToken(userId);

  setRefreshTokenCookie(res, refreshToken);
  res.json({
    user: { id: userId, email: user.email },
    accessToken,
  });
});

router.post("/refresh", async (req, res) => {
  const oldToken = req.cookies?.refreshToken as string | undefined;
  if (!oldToken) {
    res.status(401).json({ error: "Refresh token missing" });
    return;
  }

  const result = await rotateRefreshToken(oldToken, req.requestId);
  if (!result) {
    res.status(401).json({ error: "Refresh token invalid or expired" });
    return;
  }

  setRefreshTokenCookie(res, result.newRefreshToken);
  res.json({ accessToken: signAccessToken(result.userId) });
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (token) {
    await RefreshToken.deleteOne({ token });
  }

  clearRefreshTokenCookie(res);
  res.json({ success: true });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  // Always respond 200 — don't leak whether the email exists
  if (!isValidEmail(email)) {
    res.json({ message: "If that email exists, a reset link has been sent." });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    res.json({ message: "If that email exists, a reset link has been sent." });
    return;
  }

  // Invalidate any existing reset tokens for this user
  await PasswordResetToken.deleteMany({ userId: user._id });

  const rawToken  = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await PasswordResetToken.create({ tokenHash, userId: user._id, expiresAt });

  const clientUrl  = process.env.CLIENT_URL ?? "http://localhost:5173";
  const resetLink  = `${clientUrl}/reset-password?token=${rawToken}`;

  try {
    await sendPasswordResetEmail(user.email, resetLink);
    logger.info('password_reset_email_sent', { email: user.email });
  } catch (err) {
    logger.error('password_reset_email_failed', {
      email: user.email,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  res.json({ message: "If that email exists, a reset link has been sent." });
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  if (typeof token !== "string" || !token) {
    res.status(400).json({ error: "Reset token is required." });
    return;
  }

  // Keep password policy enforcement in sync here if the reset flow is
  // hardened beyond the existing minimum-length check.
  if (!isValidPassword(password)) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const record    = await PasswordResetToken.findOne({ tokenHash });

  if (!record || record.expiresAt < new Date()) {
    await PasswordResetToken.deleteOne({ tokenHash });
    res.status(400).json({ error: "This reset link has expired or is invalid. Please request a new one." });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await User.findByIdAndUpdate(record.userId, { hashedPassword });
  await PasswordResetToken.deleteOne({ tokenHash });

  res.json({ message: "Password updated successfully." });
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt,
    },
  });
});

export default router;


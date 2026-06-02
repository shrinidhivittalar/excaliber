import { Router, type Response } from "express";
import type { CookieOptions } from "express";
import bcrypt from "bcrypt";
import { User } from "../models/User";
import { RefreshToken } from "../models/RefreshToken";
import {
  signAccessToken,
  createRefreshToken,
  rotateRefreshToken,
} from "../auth/tokens";
import { requireAuth, type AuthRequest } from "../middleware/auth";

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

router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  if (!isValidPassword(password)) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
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

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email) || typeof password !== "string") {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.hashedPassword);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

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

  const result = await rotateRefreshToken(oldToken);
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

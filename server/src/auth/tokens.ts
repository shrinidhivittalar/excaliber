import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { RefreshToken } from "../models/RefreshToken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  } as jwt.SignOptions);
}

export async function createRefreshToken(userId: string): Promise<string> {
  const token = nanoid(64);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);
  await RefreshToken.create({ token, userId, expiresAt });
  return token;
}

export function verifyAccessToken(token: string): { sub: string } {
  return jwt.verify(token, ACCESS_SECRET) as { sub: string };
}

export async function rotateRefreshToken(
  oldToken: string
): Promise<{ userId: string; newRefreshToken: string } | null> {
  const existing = await RefreshToken.findOneAndDelete({ token: oldToken });
  if (!existing || existing.expiresAt < new Date()) return null;

  const userId = existing.userId.toString();
  const newRefreshToken = await createRefreshToken(userId);
  return { userId, newRefreshToken };
}

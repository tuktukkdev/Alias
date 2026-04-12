import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { prisma } from "../db/prisma";

const scryptAsync = promisify(scrypt);

const SALT_LEN = 16;
const KEY_LEN = 64;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derivedKey = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  const storedKey = Buffer.from(hash, "hex");
  if (derivedKey.length !== storedKey.length) return false;
  return timingSafeEqual(derivedKey, storedKey);
}

export interface AuthResult {
  ok: true;
  id: number;
  username: string;
}

export interface AuthFailure {
  ok: false;
  code: "USERNAME_TAKEN" | "EMAIL_TAKEN" | "USER_NOT_FOUND" | "INVALID_PASSWORD";
}

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<AuthResult | AuthFailure> {
  const existingByUsername = await prisma.user.findUnique({ where: { username } });
  if (existingByUsername) return { ok: false, code: "USERNAME_TAKEN" };

  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) return { ok: false, code: "EMAIL_TAKEN" };

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      stats: {
        create: {
          guessed: 0,
          skipped: 0,
          wins: 0,
          losses: 0,
        },
      },
    },
  });

  return { ok: true, id: user.id, username: user.username };
}

export async function loginUser(
  username: string,
  password: string
): Promise<AuthResult | AuthFailure> {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return { ok: false, code: "USER_NOT_FOUND" };

  const valid = await verifyPassword(password, user.password);
  if (!valid) return { ok: false, code: "INVALID_PASSWORD" };

  return { ok: true, id: user.id, username: user.username };
}

export interface UpdateUsernameResult {
  ok: true;
  username: string;
}
export interface UpdateUsernameFailure {
  ok: false;
  code: "USER_NOT_FOUND" | "USERNAME_TAKEN";
}

export async function updateUsername(
  userId: number,
  newUsername: string
): Promise<UpdateUsernameResult | UpdateUsernameFailure> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, code: "USER_NOT_FOUND" };

  const taken = await prisma.user.findUnique({ where: { username: newUsername } });
  if (taken && taken.id !== userId) return { ok: false, code: "USERNAME_TAKEN" };

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { username: newUsername },
  });
  return { ok: true, username: updated.username };
}

export interface UpdatePasswordResult {
  ok: true;
}
export interface UpdatePasswordFailure {
  ok: false;
  code: "USER_NOT_FOUND" | "INVALID_PASSWORD";
}

export async function updatePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<UpdatePasswordResult | UpdatePasswordFailure> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, code: "USER_NOT_FOUND" };

  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) return { ok: false, code: "INVALID_PASSWORD" };

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  return { ok: true };
}

export interface UserStats {
  guessed: number;
  skipped: number;
  wins: number;
  losses: number;
}

export async function getUserStats(userId: number): Promise<UserStats | null> {
  const stats = await prisma.userStats.findUnique({ where: { userId } });
  if (!stats) return null;
  return {
    guessed: stats.guessed,
    skipped: stats.skipped,
    wins: stats.wins,
    losses: stats.losses,
  };
}

export async function getUserAvatarUrl(userId: number): Promise<string | null> {
  const pic = await prisma.userPicture.findUnique({ where: { userId } });
  if (!pic) return null;
  return `http://localhost:3000/uploads/avatars/${pic.picturePath}`;
}

export async function upsertUserPicture(
  userId: number,
  filename: string,
  format: string
): Promise<void> {
  await prisma.userPicture.upsert({
    where: { userId },
    update: { picturePath: filename, format },
    create: { userId, picturePath: filename, format },
  });
}

export async function getExistingPicturePath(userId: number): Promise<string | null> {
  const pic = await prisma.userPicture.findUnique({ where: { userId } });
  return pic?.picturePath ?? null;
}

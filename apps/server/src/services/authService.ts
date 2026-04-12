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

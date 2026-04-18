import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// пул подключений к postgresql
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

// клиент prisma с адаптером pg
export const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

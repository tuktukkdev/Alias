import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

// синглтон-клиент redis
let client: RedisClient | null = null;

// геттер для redis клиента
export const getRedisClient = (): RedisClient | null => client;

// подключение к redis, если указан url
export const initRedis = async (): Promise<void> => {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("REDIS_URL not set – Redis cache disabled, falling back to DB for every query");
    return;
  }

  try {
    const c = createClient({ url });
    c.on("error", (err: unknown) => {
    const msg = err instanceof Error ? err.message || err.constructor.name : String(err);
    console.error("[Redis] error:", msg);
  });
    await c.connect();
    client = c;
    console.log("[Redis] connected");
  } catch (err) {
    console.error("[Redis] connection failed:", err);
  }
};

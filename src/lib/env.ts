//backend/src/lib/env.ts
import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),

  DATABASE_URL: z.string().startsWith("postgresql://"),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  API_BASE_URL: z.url().default("http://localhost:8081"),
  WEB_APP_BASE_URL: z.url().default("http://localhost:3000"),

  TRUSTED_ORIGINS: z.string().optional().default(""),
  COOKIE_DOMAIN: z.string().optional(),

  BETTER_AUTH_SECRET: z.string().min(1),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),

  MOBILE_GOOGLE_CLIENT_IDS: z.string().min(1),

  MOBILE_JWT_SECRET: z.string().min(32),
  MOBILE_ACCESS_TOKEN_TTL: z.string().default("7d"),

  MOBILE_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(200),
  RATE_LIMIT_GLOBAL_TIME_WINDOW: z.string().default("1 minute"),

  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(6),
  RATE_LIMIT_LOGIN_TIME_WINDOW: z.string().default("1 minute"),

  RATE_LIMIT_REFRESH_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_REFRESH_TIME_WINDOW: z.string().default("1 minute"),

  RATE_LIMIT_MANUAL_PLAN_MAX: z.coerce.number().int().positive().default(8),
  RATE_LIMIT_MANUAL_PLAN_TIME_WINDOW: z.string().default("10 minutes"),

  RATE_LIMIT_AI_PLAN_MAX: z.coerce.number().int().positive().default(4),
  RATE_LIMIT_AI_PLAN_TIME_WINDOW: z.string().default("15 minutes"),
});

const parsedEnv = envSchema.parse(process.env);

const trustedOriginsList = parsedEnv.TRUSTED_ORIGINS.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const env = {
  ...parsedEnv,
  TRUSTED_ORIGINS_LIST: trustedOriginsList,
};

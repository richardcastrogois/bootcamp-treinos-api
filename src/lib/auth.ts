//backend/src/lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { openAPI } from "better-auth/plugins";

import { prisma } from "./db.js";
import { env } from "./env.js";

const trustedOrigins = Array.from(
  new Set([env.WEB_APP_BASE_URL, ...env.TRUSTED_ORIGINS_LIST]),
);

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.API_BASE_URL,
  trustedOrigins,
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [openAPI()],
  advanced: {
    crossSubDomainCookies: env.COOKIE_DOMAIN
      ? {
          enabled: true,
          domain: env.COOKIE_DOMAIN,
        }
      : {
          enabled: false,
        },
  },
});

//backend/src/routes/mobile-auth.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { prisma } from "../lib/db.js";
import { env } from "../lib/env.js";
import { getMobileUserFromAuthorizationHeader } from "../lib/get-mobile-user.js";
import {
  generateMobileRefreshToken,
  hashMobileRefreshToken,
  signMobileAppToken,
  verifyGoogleIdToken,
} from "../lib/mobile-auth.js";

dayjs.extend(utc);

const AuthSuccessSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
  }),
});

const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

function getClientIp(request: {
  ip: string;
  headers: Record<string, unknown>;
}) {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0]!.trim();
  }

  return request.ip;
}

export const mobileAuthRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/google",
    config: {
      rateLimit: {
        max: env.RATE_LIMIT_LOGIN_MAX,
        timeWindow: env.RATE_LIMIT_LOGIN_TIME_WINDOW,
      },
    },
    schema: {
      tags: ["Mobile Auth"],
      summary: "Login com Google para o app mobile",
      body: z.object({
        idToken: z.string().min(1),
      }),
      response: {
        200: AuthSuccessSchema,
        401: z.object({
          error: z.string(),
          code: z.string(),
        }),
        500: z.object({
          error: z.string(),
          code: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      let googleUser: Awaited<ReturnType<typeof verifyGoogleIdToken>>;

      try {
        googleUser = await verifyGoogleIdToken(request.body.idToken);
      } catch (error) {
        app.log.error({ error }, "[MOBILE-AUTH] invalid google token");

        return reply.status(401).send({
          error: "Invalid Google token",
          code: "INVALID_GOOGLE_TOKEN",
        });
      }

      try {
        const user = await prisma.user.upsert({
          where: { email: googleUser.email },
          update: {
            name: googleUser.name,
            ...(googleUser.picture ? { image: googleUser.picture } : {}),
            ...(googleUser.emailVerified ? { emailVerified: true } : {}),
          },
          create: {
            id: crypto.randomUUID(),
            name: googleUser.name,
            email: googleUser.email,
            emailVerified: googleUser.emailVerified,
            image: googleUser.picture ?? null,
          },
        });

        const token = signMobileAppToken({
          sub: user.id,
          email: user.email,
          name: user.name,
          picture: user.image ?? undefined,
        });

        const refreshToken = generateMobileRefreshToken();
        const refreshTokenHash = hashMobileRefreshToken(refreshToken);

        await prisma.mobileRefreshToken.create({
          data: {
            tokenHash: refreshTokenHash,
            userId: user.id,
            expiresAt: dayjs
              .utc()
              .add(env.MOBILE_REFRESH_TOKEN_TTL_DAYS, "day")
              .toDate(),
            userAgent:
              typeof request.headers["user-agent"] === "string"
                ? request.headers["user-agent"]
                : null,
            ipAddress: getClientIp(request),
          },
        });

        app.log.info(
          {
            userId: user.id,
            email: user.email,
          },
          "[MOBILE-AUTH] login success",
        );

        return reply.status(200).send({
          token,
          refreshToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image ?? null,
          },
        });
      } catch (error) {
        app.log.error(
          {
            error,
            email: googleUser.email,
          },
          "[MOBILE-AUTH] login failed while upserting user",
        );

        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/refresh",
    config: {
      rateLimit: {
        max: env.RATE_LIMIT_REFRESH_MAX,
        timeWindow: env.RATE_LIMIT_REFRESH_TIME_WINDOW,
      },
    },
    schema: {
      tags: ["Mobile Auth"],
      summary: "Renova tokens do app mobile",
      body: RefreshBodySchema,
      response: {
        200: AuthSuccessSchema,
        401: z.object({
          error: z.string(),
          code: z.string(),
        }),
        500: z.object({
          error: z.string(),
          code: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      try {
        const refreshTokenHash = hashMobileRefreshToken(
          request.body.refreshToken,
        );

        const refreshTokenRecord = await prisma.mobileRefreshToken.findUnique({
          where: { tokenHash: refreshTokenHash },
          include: { user: true },
        });

        if (
          !refreshTokenRecord ||
          refreshTokenRecord.revokedAt !== null ||
          refreshTokenRecord.expiresAt.getTime() <= Date.now()
        ) {
          return reply.status(401).send({
            error: "Invalid refresh token",
            code: "INVALID_REFRESH_TOKEN",
          });
        }

        const user = refreshTokenRecord.user;

        const nextAccessToken = signMobileAppToken({
          sub: user.id,
          email: user.email,
          name: user.name,
          picture: user.image ?? undefined,
        });

        const nextRefreshToken = generateMobileRefreshToken();
        const nextRefreshTokenHash = hashMobileRefreshToken(nextRefreshToken);

        await prisma.$transaction(async (tx) => {
          await tx.mobileRefreshToken.update({
            where: { id: refreshTokenRecord.id },
            data: {
              revokedAt: new Date(),
            },
          });

          await tx.mobileRefreshToken.create({
            data: {
              tokenHash: nextRefreshTokenHash,
              userId: user.id,
              expiresAt: dayjs
                .utc()
                .add(env.MOBILE_REFRESH_TOKEN_TTL_DAYS, "day")
                .toDate(),
              userAgent:
                typeof request.headers["user-agent"] === "string"
                  ? request.headers["user-agent"]
                  : null,
              ipAddress: getClientIp(request),
            },
          });
        });

        return reply.status(200).send({
          token: nextAccessToken,
          refreshToken: nextRefreshToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image ?? null,
          },
        });
      } catch (error) {
        app.log.error({ error }, "[MOBILE-AUTH] refresh failed");

        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/logout",
    config: {
      rateLimit: {
        max: env.RATE_LIMIT_REFRESH_MAX,
        timeWindow: env.RATE_LIMIT_REFRESH_TIME_WINDOW,
      },
    },
    schema: {
      tags: ["Mobile Auth"],
      summary: "Revoga refresh token do app mobile",
      body: RefreshBodySchema,
      response: {
        204: z.null(),
        500: z.object({
          error: z.string(),
          code: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      try {
        const refreshTokenHash = hashMobileRefreshToken(
          request.body.refreshToken,
        );

        await prisma.mobileRefreshToken.updateMany({
          where: {
            tokenHash: refreshTokenHash,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });

        return reply.status(204).send(null);
      } catch (error) {
        app.log.error({ error }, "[MOBILE-AUTH] logout failed");

        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/me",
    schema: {
      tags: ["Mobile Auth"],
      summary: "Usuário autenticado no app mobile",
      response: {
        200: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          image: z.string().nullable(),
        }),
        401: z.object({
          error: z.string(),
          code: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      const user = await getMobileUserFromAuthorizationHeader(
        request.headers.authorization,
      );

      if (!user) {
        return reply.status(401).send({
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      return reply.status(200).send({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image ?? null,
      });
    },
  });
};

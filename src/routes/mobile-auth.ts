//backend/src/routes/mobile-auth.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { prisma } from "../lib/db.js";
import { getMobileUserFromAuthorizationHeader } from "../lib/get-mobile-user.js";
import { signMobileAppToken, verifyGoogleIdToken } from "../lib/mobile-auth.js";

export const mobileAuthRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/google",
    schema: {
      tags: ["Mobile Auth"],
      summary: "Login com Google para o app mobile",
      body: z.object({
        idToken: z.string().min(1),
      }),
      response: {
        200: z.object({
          token: z.string(),
          user: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            image: z.string().nullable(),
          }),
        }),
        401: z.object({
          error: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      try {
        const googleUser = await verifyGoogleIdToken(request.body.idToken);

        let user = await prisma.user.findUnique({
          where: { email: googleUser.email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              id: crypto.randomUUID(),
              name: googleUser.name,
              email: googleUser.email,
              emailVerified: googleUser.emailVerified,
              image: googleUser.picture ?? null,
            },
          });
        } else {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              name: googleUser.name,
              image: googleUser.picture ?? user.image,
              emailVerified: googleUser.emailVerified || user.emailVerified,
            },
          });
        }

        const token = signMobileAppToken({
          sub: user.id,
          email: user.email,
          name: user.name,
          picture: user.image ?? undefined,
        });

        return reply.status(200).send({
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image ?? null,
          },
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(401).send({
          error: "Invalid Google token",
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

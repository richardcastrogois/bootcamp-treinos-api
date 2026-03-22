//backend/src/routes/mobile-home.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { InvalidDateRangeError } from "../errors/index.js";
import { getMobileUserFromAuthorizationHeader } from "../lib/get-mobile-user.js";
import { ErrorSchema, HomeDataSchema } from "../schemas/index.js";
import { GetHomeData } from "../usecases/GetHomeData.js";

export const mobileHomeRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:date",
    schema: {
      tags: ["Mobile Home"],
      summary: "Home do app mobile",
      params: z.object({
        date: z.iso.date(),
      }),
      response: {
        200: HomeDataSchema,
        401: ErrorSchema,
        422: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const user = await getMobileUserFromAuthorizationHeader(
          request.headers.authorization,
        );

        if (!user) {
          return reply.status(401).send({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }

        const getHomeData = new GetHomeData();

        const result = await getHomeData.execute({
          userId: user.id,
          date: request.params.date,
        });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);

        if (error instanceof InvalidDateRangeError) {
          return reply.status(422).send({
            error: error.message,
            code: "INVALID_DATE_RANGE_ERROR",
          });
        }

        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};

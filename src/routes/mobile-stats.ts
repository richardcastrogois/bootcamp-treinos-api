//backend/src/routes/mobile-stats.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { InvalidDateRangeError, NotFoundError } from "../errors/index.js";
import { getMobileUserFromAuthorizationHeader } from "../lib/get-mobile-user.js";
import {
  ErrorSchema,
  StatsQuerySchema,
  StatsSchema,
} from "../schemas/index.js";
import { GetStats } from "../usecases/GetStats.js";

export const mobileStatsRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      tags: ["Mobile Stats"],
      summary: "Get mobile stats",
      querystring: StatsQuerySchema,
      response: {
        200: StatsSchema,
        401: ErrorSchema,
        404: ErrorSchema,
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

        const getStats = new GetStats();
        const result = await getStats.execute({
          userId: user.id,
          from: request.query.from,
          to: request.query.to,
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

        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND_ERROR",
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

//backend/src/routes/mobile-home.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { getMobileUserFromAuthorizationHeader } from "../lib/get-mobile-user.js";
import { GetHomeData } from "../usecases/GetHomeData.js";

export const mobileHomeRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:date",
    schema: {
      tags: ["Mobile Home"],
      summary: "Home do app mobile",
      params: z.object({
        date: z.string(),
      }),
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

      const getHomeData = new GetHomeData();

      const result = await getHomeData.execute({
        userId: user.id,
        date: request.params.date,
      });

      return reply.status(200).send(result);
    },
  });
};

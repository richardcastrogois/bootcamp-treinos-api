import { fromNodeHeaders } from "better-auth/node";
import dayjs from "dayjs";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { auth } from "../lib/auth.js";
import { BootstrapSchema, ErrorSchema } from "../schemas/index.js";
import { GetHomeData } from "../usecases/GetHomeData.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";

export const bootstrapRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      operationId: "getBootstrap",
      tags: ["Bootstrap"],
      summary: "Get protected app bootstrap data",
      response: {
        200: BootstrapSchema,
        401: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });

        if (!session) {
          return reply.status(401).send({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }

        const today = dayjs().format("YYYY-MM-DD");

        const getHomeData = new GetHomeData();
        const getUserTrainData = new GetUserTrainData();

        const [homeData, trainData] = await Promise.all([
          getHomeData.execute({
            userId: session.user.id,
            date: today,
          }),
          getUserTrainData.execute({
            userId: session.user.id,
          }),
        ]);

        return reply.status(200).send({
          user: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image ?? null,
          },
          homeData,
          trainData,
        });
      } catch (error) {
        app.log.error(error);

        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};

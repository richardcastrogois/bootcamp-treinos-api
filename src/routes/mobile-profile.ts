//backend/src/routes/mobile-profile.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { InvalidUserTrainDataError } from "../errors/index.js";
import { getMobileUserFromAuthorizationHeader } from "../lib/get-mobile-user.js";
import {
  ErrorSchema,
  UpsertUserTrainDataBodySchema,
  UpsertUserTrainDataSchema,
  UserTrainDataSchema,
} from "../schemas/index.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";

export const mobileProfileRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      tags: ["Mobile Profile"],
      summary: "Get mobile profile data",
      response: {
        200: z.object({
          user: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            image: z.string().nullable(),
          }),
          trainData: UserTrainDataSchema.nullable(),
        }),
        401: ErrorSchema,
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

        const getUserTrainData = new GetUserTrainData();
        const trainData = await getUserTrainData.execute({
          userId: user.id,
        });

        return reply.status(200).send({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image ?? null,
          },
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

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PUT",
    url: "/train-data",
    schema: {
      tags: ["Mobile Profile"],
      summary: "Upsert mobile train data",
      body: UpsertUserTrainDataBodySchema,
      response: {
        200: UpsertUserTrainDataSchema,
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

        const upsertUserTrainData = new UpsertUserTrainData();
        const result = await upsertUserTrainData.execute({
          userId: user.id,
          weightInGrams: request.body.weightInGrams,
          heightInCentimeters: request.body.heightInCentimeters,
          age: request.body.age,
          bodyFatPercentage: request.body.bodyFatPercentage,
        });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);

        if (error instanceof InvalidUserTrainDataError) {
          return reply.status(422).send({
            error: error.message,
            code: "INVALID_USER_TRAIN_DATA_ERROR",
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

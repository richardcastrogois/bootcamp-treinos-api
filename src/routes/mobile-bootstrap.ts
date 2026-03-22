//backend/src/routes/mobile-bootstrap.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { getMobileUserFromAuthorizationHeader } from "../lib/get-mobile-user.js";
import { GetHomeData } from "../usecases/GetHomeData.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";

dayjs.extend(utc);

export const mobileBootstrapRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      tags: ["Mobile Bootstrap"],
      summary: "Bootstrap protegido do app mobile",
      response: {
        200: z.object({
          user: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            image: z.string().nullable(),
          }),
          homeData: z.object({
            activeWorkoutPlanId: z.string().uuid().optional(),
            todayWorkoutDay: z
              .object({
                workoutPlanId: z.string().uuid(),
                id: z.string().uuid(),
                name: z.string(),
                isRest: z.boolean(),
                weekDay: z.enum([
                  "MONDAY",
                  "TUESDAY",
                  "WEDNESDAY",
                  "THURSDAY",
                  "FRIDAY",
                  "SATURDAY",
                  "SUNDAY",
                ]),
                estimatedDurationInSeconds: z.number(),
                coverImageUrl: z.string().url().optional(),
                exercisesCount: z.number(),
              })
              .optional(),
            workoutStreak: z.number(),
            consistencyByDay: z.record(
              z.string(),
              z.object({
                workoutDayCompleted: z.boolean(),
                workoutDayStarted: z.boolean(),
              }),
            ),
          }),
          trainData: z
            .object({
              userId: z.string(),
              userName: z.string(),
              weightInGrams: z.number(),
              heightInCentimeters: z.number(),
              age: z.number(),
              bodyFatPercentage: z.number(),
            })
            .nullable(),
          hasActivePlan: z.boolean(),
          needsOnboarding: z.boolean(),
        }),
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
        const user = await getMobileUserFromAuthorizationHeader(
          request.headers.authorization,
        );

        if (!user) {
          return reply.status(401).send({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }

        const today = dayjs.utc().format("YYYY-MM-DD");

        const getHomeData = new GetHomeData();
        const getUserTrainData = new GetUserTrainData();

        const [homeData, trainData] = await Promise.all([
          getHomeData.execute({
            userId: user.id,
            date: today,
          }),
          getUserTrainData.execute({
            userId: user.id,
          }),
        ]);

        const hasActivePlan = !!homeData.activeWorkoutPlanId;
        const needsOnboarding = !hasActivePlan || !trainData;

        return reply.status(200).send({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image ?? null,
          },
          homeData,
          trainData,
          hasActivePlan,
          needsOnboarding,
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

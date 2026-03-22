//backend/src/routes/mobile-workout-plans.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import {
  InvalidWorkoutPlanError,
  InvalidWorkoutSessionCompletionError,
  NotFoundError,
  SessionAlreadyStartedError,
  WorkoutDayIsRestError,
  WorkoutPlanNotActiveError,
  WorkoutSessionAlreadyCompletedError,
} from "../errors/index.js";
import { getMobileUserFromAuthorizationHeader } from "../lib/get-mobile-user.js";
import {
  ErrorSchema,
  GetWorkoutDaySchema,
  GetWorkoutPlanSchema,
  ListWorkoutPlansQuerySchema,
  ListWorkoutPlansSchema,
  StartWorkoutSessionSchema,
  UpdateWorkoutSessionBodySchema,
  UpdateWorkoutSessionSchema,
  WorkoutPlanSchema,
} from "../schemas/index.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { GetWorkoutDay } from "../usecases/GetWorkoutDay.js";
import { GetWorkoutPlan } from "../usecases/GetWorkoutPlan.js";
import { ListWorkoutPlans } from "../usecases/ListWorkoutPlans.js";
import { StartWorkoutSession } from "../usecases/StartWorkoutSession.js";
import { UpdateWorkoutSession } from "../usecases/UpdateWorkoutSession.js";

export const mobileWorkoutPlanRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      tags: ["Mobile Workout Plan"],
      summary: "List mobile workout plans",
      querystring: ListWorkoutPlansQuerySchema,
      response: {
        200: ListWorkoutPlansSchema,
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

        const listWorkoutPlans = new ListWorkoutPlans();
        const result = await listWorkoutPlans.execute({
          userId: user.id,
          active: request.query.active,
        });

        return reply.status(200).send(result);
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
    method: "POST",
    url: "/",
    schema: {
      tags: ["Mobile Workout Plan"],
      summary: "Create mobile workout plan",
      body: WorkoutPlanSchema.omit({ id: true }),
      response: {
        201: WorkoutPlanSchema,
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

        const createWorkoutPlan = new CreateWorkoutPlan();
        const result = await createWorkoutPlan.execute({
          userId: user.id,
          name: request.body.name,
          workoutDays: request.body.workoutDays,
        });

        return reply.status(201).send(result);
      } catch (error) {
        app.log.error(error);

        if (error instanceof InvalidWorkoutPlanError) {
          return reply.status(422).send({
            error: error.message,
            code: "INVALID_WORKOUT_PLAN_ERROR",
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

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:workoutPlanId",
    schema: {
      tags: ["Mobile Workout Plan"],
      summary: "Get mobile workout plan",
      params: z.object({
        workoutPlanId: z.uuid(),
      }),
      response: {
        200: GetWorkoutPlanSchema,
        401: ErrorSchema,
        404: ErrorSchema,
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

        const getWorkoutPlan = new GetWorkoutPlan();
        const result = await getWorkoutPlan.execute({
          userId: user.id,
          workoutPlanId: request.params.workoutPlanId,
        });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);

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

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:workoutPlanId/days/:workoutDayId",
    schema: {
      tags: ["Mobile Workout Plan"],
      summary: "Get mobile workout day",
      params: z.object({
        workoutPlanId: z.uuid(),
        workoutDayId: z.uuid(),
      }),
      response: {
        200: GetWorkoutDaySchema,
        401: ErrorSchema,
        404: ErrorSchema,
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

        const getWorkoutDay = new GetWorkoutDay();
        const result = await getWorkoutDay.execute({
          userId: user.id,
          workoutPlanId: request.params.workoutPlanId,
          workoutDayId: request.params.workoutDayId,
        });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);

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

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/:workoutPlanId/days/:workoutDayId/sessions",
    schema: {
      tags: ["Mobile Workout Plan"],
      summary: "Start mobile workout session",
      params: z.object({
        workoutPlanId: z.uuid(),
        workoutDayId: z.uuid(),
      }),
      response: {
        201: StartWorkoutSessionSchema,
        401: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
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

        const startWorkoutSession = new StartWorkoutSession();
        const result = await startWorkoutSession.execute({
          userId: user.id,
          workoutPlanId: request.params.workoutPlanId,
          workoutDayId: request.params.workoutDayId,
        });

        return reply.status(201).send(result);
      } catch (error) {
        app.log.error(error);

        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND_ERROR",
          });
        }

        if (error instanceof WorkoutPlanNotActiveError) {
          return reply.status(422).send({
            error: error.message,
            code: "WORKOUT_PLAN_NOT_ACTIVE_ERROR",
          });
        }

        if (error instanceof WorkoutDayIsRestError) {
          return reply.status(422).send({
            error: error.message,
            code: "WORKOUT_DAY_IS_REST_ERROR",
          });
        }

        if (error instanceof SessionAlreadyStartedError) {
          return reply.status(409).send({
            error: error.message,
            code: "SESSION_ALREADY_STARTED_ERROR",
          });
        }

        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PATCH",
    url: "/:workoutPlanId/days/:workoutDayId/sessions/:sessionId",
    schema: {
      tags: ["Mobile Workout Plan"],
      summary: "Finish mobile workout session",
      params: z.object({
        workoutPlanId: z.uuid(),
        workoutDayId: z.uuid(),
        sessionId: z.uuid(),
      }),
      body: UpdateWorkoutSessionBodySchema,
      response: {
        200: UpdateWorkoutSessionSchema,
        401: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
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

        const updateWorkoutSession = new UpdateWorkoutSession();
        const result = await updateWorkoutSession.execute({
          userId: user.id,
          workoutPlanId: request.params.workoutPlanId,
          workoutDayId: request.params.workoutDayId,
          sessionId: request.params.sessionId,
          completedAt: request.body.completedAt,
        });

        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);

        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND_ERROR",
          });
        }

        if (error instanceof WorkoutSessionAlreadyCompletedError) {
          return reply.status(409).send({
            error: error.message,
            code: "WORKOUT_SESSION_ALREADY_COMPLETED_ERROR",
          });
        }

        if (error instanceof InvalidWorkoutSessionCompletionError) {
          return reply.status(422).send({
            error: error.message,
            code: "INVALID_WORKOUT_SESSION_COMPLETION_ERROR",
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

//backend/src/routes/mobile-onboarding.ts
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import {
  InvalidUserTrainDataError,
  InvalidWorkoutPlanError,
} from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { env } from "../lib/env.js";
import { getMobileUserFromAuthorizationHeader } from "../lib/get-mobile-user.js";
import {
  buildManualWorkoutPlan,
  LOWER_COVER_URLS,
  UPPER_COVER_URLS,
} from "../lib/manual-plan-builder.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";

const usersCreatingManualPlan = new Set<string>();
const usersCreatingAiPlan = new Set<string>();

const TrainDataInputSchema = z.object({
  weightInGrams: z.number().int().positive(),
  heightInCentimeters: z.number().int().positive(),
  age: z.number().int().positive(),
  bodyFatPercentage: z.number().int().min(0).max(100),
});

const PlanPreferencesSchema = z.object({
  goal: z.enum(["hypertrophy", "strength", "weight_loss", "health"]),
  daysPerWeek: z.number().int().min(1).max(6),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  sessionDurationInMinutes: z.number().int().min(20).max(120),
  restrictions: z.string().trim().optional().default(""),
});

const CreatePlanRequestSchema = z.object({
  trainData: TrainDataInputSchema,
  preferences: PlanPreferencesSchema,
});

const GeneratedWorkoutPlanDaySchema = z
  .object({
    name: z.string().min(1),
    weekDay: z.enum(WeekDay),
    isRest: z.boolean(),
    estimatedDurationInSeconds: z.number().int().min(0),
    coverImageUrl: z.string().url().optional(),
    exercises: z.array(
      z.object({
        order: z.number().int().min(1),
        name: z.string().min(1),
        sets: z.number().int().min(1),
        reps: z.number().int().min(1),
        restTimeInSeconds: z.number().int().min(1),
      }),
    ),
  })
  .superRefine((day, ctx) => {
    if (day.isRest) {
      if (day.estimatedDurationInSeconds !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["estimatedDurationInSeconds"],
          message:
            "Dias de descanso devem ter estimatedDurationInSeconds igual a 0.",
        });
      }

      if (day.exercises.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["exercises"],
          message: "Dias de descanso não podem ter exercícios.",
        });
      }

      return;
    }

    if (day.estimatedDurationInSeconds < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["estimatedDurationInSeconds"],
        message:
          "Dias de treino devem ter estimatedDurationInSeconds maior que 0.",
      });
    }

    if (day.exercises.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exercises"],
        message: "Dias de treino devem ter pelo menos 1 exercício.",
      });
    }
  });

const GeneratedWorkoutPlanSchema = z
  .object({
    name: z.string().min(1),
    workoutDays: z.array(GeneratedWorkoutPlanDaySchema).length(7),
  })
  .superRefine((plan, ctx) => {
    const weekDays = plan.workoutDays.map((day) => day.weekDay);
    const uniqueWeekDays = new Set(weekDays);

    if (uniqueWeekDays.size !== 7) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workoutDays"],
        message:
          "O plano deve conter exatamente um item para cada dia da semana.",
      });
    }
  });

const CreatedWorkoutPlanResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  workoutDays: z.array(
    z.object({
      name: z.string().min(1),
      weekDay: z.enum(WeekDay),
      isRest: z.boolean(),
      estimatedDurationInSeconds: z.number().int().min(0),
      coverImageUrl: z.string().url().optional(),
      exercises: z.array(
        z.object({
          order: z.number().int().min(1),
          name: z.string().min(1),
          sets: z.number().int().min(1),
          reps: z.number().int().min(1),
          restTimeInSeconds: z.number().int().min(1),
        }),
      ),
    }),
  ),
});

const ConflictResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export const mobileOnboardingRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/manual-plan",
    config: {
      rateLimit: {
        max: env.RATE_LIMIT_MANUAL_PLAN_MAX,
        timeWindow: env.RATE_LIMIT_MANUAL_PLAN_TIME_WINDOW,
      },
    },
    schema: {
      tags: ["Mobile Onboarding"],
      summary: "Cria plano manual no onboarding mobile",
      body: CreatePlanRequestSchema,
      response: {
        201: CreatedWorkoutPlanResponseSchema,
        401: z.object({
          error: z.string(),
          code: z.string(),
        }),
        409: ConflictResponseSchema,
        422: z.object({
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
      let lockedUserId: string | null = null;

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

        if (usersCreatingManualPlan.has(user.id)) {
          return reply.status(409).send({
            error: "Já existe uma criação de plano manual em andamento",
            code: "PLAN_CREATION_ALREADY_IN_PROGRESS",
          });
        }

        usersCreatingManualPlan.add(user.id);
        lockedUserId = user.id;

        const upsertUserTrainData = new UpsertUserTrainData();
        await upsertUserTrainData.execute({
          userId: user.id,
          ...request.body.trainData,
        });

        const generatedPlan = buildManualWorkoutPlan({
          goal: request.body.preferences.goal,
          daysPerWeek: request.body.preferences.daysPerWeek,
          experienceLevel: request.body.preferences.experienceLevel,
          sessionDurationInMinutes:
            request.body.preferences.sessionDurationInMinutes,
        });

        const createWorkoutPlan = new CreateWorkoutPlan();
        const createdPlan = await createWorkoutPlan.execute({
          userId: user.id,
          name: generatedPlan.name,
          workoutDays: generatedPlan.workoutDays,
        });

        return reply.status(201).send(createdPlan);
      } catch (error) {
        app.log.error(error);

        if (error instanceof InvalidUserTrainDataError) {
          return reply.status(422).send({
            error: error.message,
            code: "INVALID_USER_TRAIN_DATA_ERROR",
          });
        }

        if (error instanceof InvalidWorkoutPlanError) {
          return reply.status(422).send({
            error: error.message,
            code: "INVALID_WORKOUT_PLAN_ERROR",
          });
        }

        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      } finally {
        if (lockedUserId) {
          usersCreatingManualPlan.delete(lockedUserId);
        }
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/ai-plan",
    config: {
      rateLimit: {
        max: env.RATE_LIMIT_AI_PLAN_MAX,
        timeWindow: env.RATE_LIMIT_AI_PLAN_TIME_WINDOW,
      },
    },
    schema: {
      tags: ["Mobile Onboarding"],
      summary: "Cria plano com IA no onboarding mobile com payload consolidado",
      body: CreatePlanRequestSchema,
      response: {
        201: CreatedWorkoutPlanResponseSchema,
        401: z.object({
          error: z.string(),
          code: z.string(),
        }),
        409: ConflictResponseSchema,
        422: z.object({
          error: z.string(),
          code: z.string(),
        }),
        504: z.object({
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
      let lockedUserId: string | null = null;

      try {
        app.log.info("[AI-PLAN] Início da rota");

        const user = await getMobileUserFromAuthorizationHeader(
          request.headers.authorization,
        );

        app.log.info({ hasUser: !!user }, "[AI-PLAN] Usuário validado?");

        if (!user) {
          return reply.status(401).send({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }

        if (usersCreatingAiPlan.has(user.id)) {
          return reply.status(409).send({
            error: "Já existe uma criação de plano com IA em andamento",
            code: "PLAN_CREATION_ALREADY_IN_PROGRESS",
          });
        }

        usersCreatingAiPlan.add(user.id);
        lockedUserId = user.id;

        const upsertUserTrainData = new UpsertUserTrainData();

        app.log.info("[AI-PLAN] Salvando trainData");
        await upsertUserTrainData.execute({
          userId: user.id,
          ...request.body.trainData,
        });
        app.log.info("[AI-PLAN] TrainData salvo");

        const prompt = `
Você é um personal trainer virtual especialista em montar planos de treino em formato estruturado.

Gere um plano de treino completo em PT-BR respeitando EXATAMENTE o schema solicitado.

Dados do usuário:
- Peso: ${request.body.trainData.weightInGrams} gramas
- Altura: ${request.body.trainData.heightInCentimeters} cm
- Idade: ${request.body.trainData.age}
- Gordura corporal: ${request.body.trainData.bodyFatPercentage}%

Preferências:
- Objetivo: ${request.body.preferences.goal}
- Dias por semana: ${request.body.preferences.daysPerWeek}
- Nível: ${request.body.preferences.experienceLevel}
- Duração por sessão: ${request.body.preferences.sessionDurationInMinutes} minutos
- Restrições: ${request.body.preferences.restrictions || "nenhuma"}

Regras obrigatórias:
1. O plano deve ter EXATAMENTE 7 dias: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY.
2. Deve haver exatamente ${request.body.preferences.daysPerWeek} dias de treino e os demais devem ser descanso.
3. Dias de descanso devem ter:
   - name: "Descanso"
   - isRest: true
   - estimatedDurationInSeconds: 0
   - exercises: []
4. Dias de treino devem ter entre 4 e 7 exercícios.
5. Não treine o mesmo grupo muscular principal em dias consecutivos.
6. Use nomes curtos e claros em PT-BR.
7. Para treinos de membros superiores / push / pull / upper / full body, use UMA das seguintes imagens:
   - ${UPPER_COVER_URLS[0]}
   - ${UPPER_COVER_URLS[1]}
8. Para treinos de pernas / lower, use UMA das seguintes imagens:
   - ${LOWER_COVER_URLS[0]}
   - ${LOWER_COVER_URLS[1]}
9. Para objetivo de força use menos repetições e descanso maior.
10. Para hipertrofia use faixa moderada de repetições.
11. Para emagrecimento/saúde, mantenha um plano simples, seguro e equilibrado.
12. TODO exercício deve ter:
   - sets >= 1
   - reps >= 1
   - restTimeInSeconds >= 1
13. NÃO use exercícios por tempo no lugar de repetições.
14. NÃO use reps 0.
15. Se quiser usar exercícios como prancha, abdominal isométrico ou similares, ainda assim defina reps com valor mínimo 1.
16. Não escreva texto fora do objeto final.
`;

        app.log.info(
          { promptLength: prompt.length },
          "[AI-PLAN] Prompt montado",
        );

        app.log.info("[AI-PLAN] Chamando generateObject");

        const aiPromise = generateObject({
          model: google("gemini-2.5-flash"),
          schema: GeneratedWorkoutPlanSchema,
          prompt,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("AI_GENERATION_TIMEOUT"));
          }, 45000);
        });

        const result = (await Promise.race([
          aiPromise,
          timeoutPromise,
        ])) as Awaited<typeof aiPromise>;

        const object = result.object;

        app.log.info(
          {
            planName: object.name,
            workoutDaysCount: object.workoutDays.length,
          },
          "[AI-PLAN] generateObject concluído",
        );

        const createWorkoutPlan = new CreateWorkoutPlan();

        app.log.info("[AI-PLAN] Salvando plano no banco");
        const createdPlan = await createWorkoutPlan.execute({
          userId: user.id,
          name: object.name,
          workoutDays: object.workoutDays,
        });

        app.log.info(
          { planId: createdPlan.id },
          "[AI-PLAN] Plano salvo no banco",
        );

        return reply.status(201).send(createdPlan);
      } catch (error) {
        app.log.error("[AI-PLAN] Erro na rota");
        app.log.error(error);

        if (
          error instanceof InvalidUserTrainDataError ||
          error instanceof InvalidWorkoutPlanError
        ) {
          return reply.status(422).send({
            error: error.message,
            code:
              error instanceof InvalidUserTrainDataError
                ? "INVALID_USER_TRAIN_DATA_ERROR"
                : "INVALID_WORKOUT_PLAN_ERROR",
          });
        }

        if (
          error instanceof Error &&
          error.message === "AI_GENERATION_TIMEOUT"
        ) {
          return reply.status(504).send({
            error: "AI generation timeout",
            code: "AI_GENERATION_TIMEOUT",
          });
        }

        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      } finally {
        if (lockedUserId) {
          usersCreatingAiPlan.delete(lockedUserId);
        }
      }
    },
  });
};

//backend/src/schemas/index.ts
import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";

const PositiveIntegerSchema = z.number().int().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);
const BodyFatPercentageSchema = z.number().int().min(0).max(100);

const WorkoutExerciseInputSchema = z.object({
  order: PositiveIntegerSchema,
  name: z.string().trim().min(1),
  sets: PositiveIntegerSchema,
  reps: PositiveIntegerSchema,
  restTimeInSeconds: PositiveIntegerSchema,
});

const WorkoutDayInputSchema = z
  .object({
    name: z.string().trim().min(1),
    weekDay: z.enum(WeekDay),
    isRest: z.boolean().default(false),
    estimatedDurationInSeconds: NonNegativeIntegerSchema,
    coverImageUrl: z.url().optional(),
    exercises: z.array(WorkoutExerciseInputSchema),
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

    const orders = day.exercises.map((exercise) => exercise.order);
    const uniqueOrders = new Set(orders);

    if (uniqueOrders.size !== orders.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exercises"],
        message: "A ordem dos exercícios não pode se repetir no mesmo dia.",
      });
    }

    const sortedOrders = [...orders].sort((a, b) => a - b);

    for (let index = 0; index < sortedOrders.length; index++) {
      const expectedOrder = index + 1;

      if (sortedOrders[index] !== expectedOrder) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["exercises"],
          message: "A ordem dos exercícios deve ser sequencial e começar em 1.",
        });
        break;
      }
    }
  });

const WorkoutDaysInputSchema = z
  .array(WorkoutDayInputSchema)
  .length(7)
  .superRefine((days, ctx) => {
    const weekDays = days.map((day) => day.weekDay);
    const uniqueWeekDays = new Set(weekDays);

    if (uniqueWeekDays.size !== days.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workoutDays"],
        message: "O plano deve conter cada dia da semana apenas uma vez.",
      });
    }

    const expectedWeekDays = Object.values(WeekDay);

    for (const weekDay of expectedWeekDays) {
      if (!weekDays.includes(weekDay)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workoutDays"],
          message: `O plano deve conter o dia ${weekDay}.`,
        });
      }
    }
  });

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export const StartWorkoutSessionSchema = z.object({
  userWorkoutSessionId: z.uuid(),
});

export const UpdateWorkoutSessionBodySchema = z.object({
  completedAt: z.iso.datetime(),
});

export const UpdateWorkoutSessionSchema = z.object({
  id: z.uuid(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
});

export const StatsQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .refine((value) => value.from <= value.to, {
    message: "`from` deve ser menor ou igual a `to`.",
    path: ["to"],
  });

export const StatsSchema = z.object({
  workoutStreak: z.number(),
  consistencyByDay: z.record(
    z.iso.date(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
  completedWorkoutsCount: z.number(),
  conclusionRate: z.number(),
  totalTimeInSeconds: z.number(),
});

export const HomeDataSchema = z.object({
  activeWorkoutPlanId: z.uuid().optional(),
  todayWorkoutDay: z
    .object({
      workoutPlanId: z.uuid(),
      id: z.uuid(),
      name: z.string(),
      isRest: z.boolean(),
      weekDay: z.enum(WeekDay),
      estimatedDurationInSeconds: NonNegativeIntegerSchema,
      coverImageUrl: z.url().optional(),
      exercisesCount: z.number(),
    })
    .optional(),
  workoutStreak: z.number(),
  consistencyByDay: z.record(
    z.iso.date(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
});

export const GetWorkoutDaySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  isRest: z.boolean(),
  coverImageUrl: z.url().optional(),
  estimatedDurationInSeconds: NonNegativeIntegerSchema,
  weekDay: z.enum(WeekDay),
  exercises: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      order: PositiveIntegerSchema,
      workoutDayId: z.uuid(),
      sets: PositiveIntegerSchema,
      reps: PositiveIntegerSchema,
      restTimeInSeconds: PositiveIntegerSchema,
    }),
  ),
  sessions: z.array(
    z.object({
      id: z.uuid(),
      workoutDayId: z.uuid(),
      startedAt: z.iso.datetime().optional(),
      completedAt: z.iso.datetime().optional(),
    }),
  ),
});

export const GetWorkoutPlanSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  workoutDays: z.array(
    z.object({
      id: z.uuid(),
      weekDay: z.enum(WeekDay),
      name: z.string(),
      isRest: z.boolean(),
      coverImageUrl: z.url().optional(),
      estimatedDurationInSeconds: NonNegativeIntegerSchema,
      exercisesCount: z.number(),
    }),
  ),
});

export const ListWorkoutPlansQuerySchema = z.object({
  active: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const ListWorkoutPlansSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    isActive: z.boolean(),
    workoutDays: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        weekDay: z.enum(WeekDay),
        isRest: z.boolean(),
        estimatedDurationInSeconds: NonNegativeIntegerSchema,
        coverImageUrl: z.url().optional(),
        exercises: z.array(
          z.object({
            id: z.uuid(),
            order: PositiveIntegerSchema,
            name: z.string(),
            sets: PositiveIntegerSchema,
            reps: PositiveIntegerSchema,
            restTimeInSeconds: PositiveIntegerSchema,
          }),
        ),
      }),
    ),
  }),
);

export const UpsertUserTrainDataBodySchema = z.object({
  weightInGrams: PositiveIntegerSchema,
  heightInCentimeters: PositiveIntegerSchema,
  age: PositiveIntegerSchema,
  bodyFatPercentage: BodyFatPercentageSchema,
});

export const UserTrainDataSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  weightInGrams: PositiveIntegerSchema,
  heightInCentimeters: PositiveIntegerSchema,
  age: PositiveIntegerSchema,
  bodyFatPercentage: BodyFatPercentageSchema,
});

export const UpsertUserTrainDataSchema = z.object({
  userId: z.string(),
  weightInGrams: PositiveIntegerSchema,
  heightInCentimeters: PositiveIntegerSchema,
  age: PositiveIntegerSchema,
  bodyFatPercentage: BodyFatPercentageSchema,
});

export const WorkoutPlanSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  workoutDays: WorkoutDaysInputSchema,
});

export const BootstrapSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable().optional(),
  }),
  homeData: HomeDataSchema,
  trainData: UserTrainDataSchema.nullable(),
});

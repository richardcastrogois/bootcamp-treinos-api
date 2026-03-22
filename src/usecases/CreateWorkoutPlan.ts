//backend/src/usecases/CreateWorkoutPlan.ts
import { InvalidWorkoutPlanError, NotFoundError } from "../errors/index.js";
import { Prisma } from "../generated/prisma/client.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  name: string;
  workoutDays: Array<{
    name: string;
    weekDay: WeekDay;
    isRest: boolean;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string;
    exercises: Array<{
      order: number;
      name: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

interface OutputDto {
  id: string;
  name: string;
  workoutDays: Array<{
    name: string;
    weekDay: WeekDay;
    isRest: boolean;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string;
    exercises: Array<{
      order: number;
      name: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

function normalizeWorkoutDays(
  workoutDays: InputDto["workoutDays"] | OutputDto["workoutDays"],
) {
  return [...workoutDays]
    .map((day) => ({
      name: day.name.trim(),
      weekDay: day.weekDay,
      isRest: day.isRest,
      estimatedDurationInSeconds: day.estimatedDurationInSeconds,
      coverImageUrl: day.coverImageUrl ?? null,
      exercises: [...day.exercises]
        .map((exercise) => ({
          order: exercise.order,
          name: exercise.name.trim(),
          sets: exercise.sets,
          reps: exercise.reps,
          restTimeInSeconds: exercise.restTimeInSeconds,
        }))
        .sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => a.weekDay.localeCompare(b.weekDay));
}

function areWorkoutPlansEquivalent(
  a: Pick<InputDto, "name" | "workoutDays">,
  b: Pick<OutputDto, "name" | "workoutDays">,
) {
  if (a.name.trim() !== b.name.trim()) {
    return false;
  }

  const normalizedA = normalizeWorkoutDays(a.workoutDays);
  const normalizedB = normalizeWorkoutDays(b.workoutDays);

  return JSON.stringify(normalizedA) === JSON.stringify(normalizedB);
}

function assertValidWorkoutPlan(dto: InputDto) {
  if (!dto.name.trim()) {
    throw new InvalidWorkoutPlanError("Workout plan name is required");
  }

  if (dto.workoutDays.length !== 7) {
    throw new InvalidWorkoutPlanError(
      "Workout plan must contain exactly 7 workout days",
    );
  }

  const expectedWeekDays = Object.values(WeekDay);
  const receivedWeekDays = dto.workoutDays.map((day) => day.weekDay);
  const uniqueWeekDays = new Set(receivedWeekDays);

  if (uniqueWeekDays.size !== dto.workoutDays.length) {
    throw new InvalidWorkoutPlanError(
      "Workout plan cannot contain duplicate weekdays",
    );
  }

  for (const expectedWeekDay of expectedWeekDays) {
    if (!receivedWeekDays.includes(expectedWeekDay)) {
      throw new InvalidWorkoutPlanError(
        `Workout plan must contain the weekday ${expectedWeekDay}`,
      );
    }
  }

  for (const workoutDay of dto.workoutDays) {
    if (!workoutDay.name.trim()) {
      throw new InvalidWorkoutPlanError("Workout day name is required");
    }

    if (workoutDay.isRest) {
      if (workoutDay.estimatedDurationInSeconds !== 0) {
        throw new InvalidWorkoutPlanError(
          `Rest day "${workoutDay.weekDay}" must have estimatedDurationInSeconds equal to 0`,
        );
      }

      if (workoutDay.exercises.length > 0) {
        throw new InvalidWorkoutPlanError(
          `Rest day "${workoutDay.weekDay}" cannot contain exercises`,
        );
      }

      continue;
    }

    if (!Number.isInteger(workoutDay.estimatedDurationInSeconds)) {
      throw new InvalidWorkoutPlanError(
        `Workout day "${workoutDay.weekDay}" must have an integer estimatedDurationInSeconds`,
      );
    }

    if (workoutDay.estimatedDurationInSeconds < 1) {
      throw new InvalidWorkoutPlanError(
        `Workout day "${workoutDay.weekDay}" must have estimatedDurationInSeconds greater than 0`,
      );
    }

    if (workoutDay.exercises.length < 1) {
      throw new InvalidWorkoutPlanError(
        `Workout day "${workoutDay.weekDay}" must contain at least 1 exercise`,
      );
    }

    const sortedOrders = [...workoutDay.exercises]
      .map((exercise) => exercise.order)
      .sort((a, b) => a - b);

    const uniqueOrders = new Set(sortedOrders);

    if (uniqueOrders.size !== sortedOrders.length) {
      throw new InvalidWorkoutPlanError(
        `Workout day "${workoutDay.weekDay}" cannot contain duplicate exercise orders`,
      );
    }

    for (let index = 0; index < sortedOrders.length; index++) {
      const expectedOrder = index + 1;

      if (sortedOrders[index] !== expectedOrder) {
        throw new InvalidWorkoutPlanError(
          `Workout day "${workoutDay.weekDay}" must have sequential exercise orders starting at 1`,
        );
      }
    }

    for (const exercise of workoutDay.exercises) {
      if (!exercise.name.trim()) {
        throw new InvalidWorkoutPlanError(
          `Workout day "${workoutDay.weekDay}" contains an exercise without name`,
        );
      }

      if (!Number.isInteger(exercise.order) || exercise.order < 1) {
        throw new InvalidWorkoutPlanError(
          `Workout day "${workoutDay.weekDay}" contains an invalid exercise order`,
        );
      }

      if (!Number.isInteger(exercise.sets) || exercise.sets < 1) {
        throw new InvalidWorkoutPlanError(
          `Workout day "${workoutDay.weekDay}" contains an exercise with invalid sets`,
        );
      }

      if (!Number.isInteger(exercise.reps) || exercise.reps < 1) {
        throw new InvalidWorkoutPlanError(
          `Workout day "${workoutDay.weekDay}" contains an exercise with invalid reps`,
        );
      }

      if (
        !Number.isInteger(exercise.restTimeInSeconds) ||
        exercise.restTimeInSeconds < 1
      ) {
        throw new InvalidWorkoutPlanError(
          `Workout day "${workoutDay.weekDay}" contains an exercise with invalid rest time`,
        );
      }
    }
  }
}

export class CreateWorkoutPlan {
  async execute(dto: InputDto): Promise<OutputDto> {
    assertValidWorkoutPlan(dto);

    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM "user"
          WHERE id = ${dto.userId}
          FOR UPDATE
        `;

        const existingWorkoutPlan = await tx.workoutPlan.findFirst({
          where: {
            userId: dto.userId,
            isActive: true,
          },
          include: {
            workoutDays: {
              include: {
                exercises: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (existingWorkoutPlan) {
          const existingPlanFormatted: OutputDto = {
            id: existingWorkoutPlan.id,
            name: existingWorkoutPlan.name,
            workoutDays: existingWorkoutPlan.workoutDays.map((day) => ({
              name: day.name,
              weekDay: day.weekDay,
              isRest: day.isRest,
              estimatedDurationInSeconds: day.estimatedDurationInSeconds,
              coverImageUrl: day.coverImageUrl ?? undefined,
              exercises: day.exercises
                .map((exercise) => ({
                  order: exercise.order,
                  name: exercise.name,
                  sets: exercise.sets,
                  reps: exercise.reps,
                  restTimeInSeconds: exercise.restTimeInSeconds,
                }))
                .sort((a, b) => a.order - b.order),
            })),
          };

          const isSameAsCurrentActivePlan = areWorkoutPlansEquivalent(
            {
              name: dto.name,
              workoutDays: dto.workoutDays,
            },
            {
              name: existingPlanFormatted.name,
              workoutDays: existingPlanFormatted.workoutDays,
            },
          );

          if (isSameAsCurrentActivePlan) {
            return {
              ...existingPlanFormatted,
              workoutDays: normalizeWorkoutDays(
                existingPlanFormatted.workoutDays,
              ).map((day) => ({
                ...day,
                coverImageUrl: day.coverImageUrl ?? undefined,
              })),
            };
          }

          await tx.workoutPlan.updateMany({
            where: {
              userId: dto.userId,
              isActive: true,
            },
            data: {
              isActive: false,
            },
          });
        }

        const normalizedInputDays = normalizeWorkoutDays(dto.workoutDays);

        const workoutPlan = await tx.workoutPlan.create({
          data: {
            id: crypto.randomUUID(),
            name: dto.name.trim(),
            userId: dto.userId,
            isActive: true,
            workoutDays: {
              create: normalizedInputDays.map((workoutDay) => ({
                name: workoutDay.name,
                weekDay: workoutDay.weekDay,
                isRest: workoutDay.isRest,
                estimatedDurationInSeconds:
                  workoutDay.estimatedDurationInSeconds,
                coverImageUrl: workoutDay.coverImageUrl ?? undefined,
                exercises: {
                  create: workoutDay.exercises.map((exercise) => ({
                    name: exercise.name,
                    order: exercise.order,
                    sets: exercise.sets,
                    reps: exercise.reps,
                    restTimeInSeconds: exercise.restTimeInSeconds,
                  })),
                },
              })),
            },
          },
        });

        const result = await tx.workoutPlan.findUnique({
          where: { id: workoutPlan.id },
          include: {
            workoutDays: {
              include: {
                exercises: true,
              },
            },
          },
        });

        if (!result) {
          throw new NotFoundError("Workout plan not found");
        }

        return {
          id: result.id,
          name: result.name,
          workoutDays: normalizeWorkoutDays(
            result.workoutDays.map((day) => ({
              name: day.name,
              weekDay: day.weekDay,
              isRest: day.isRest,
              estimatedDurationInSeconds: day.estimatedDurationInSeconds,
              coverImageUrl: day.coverImageUrl ?? undefined,
              exercises: day.exercises.map((exercise) => ({
                order: exercise.order,
                name: exercise.name,
                sets: exercise.sets,
                reps: exercise.reps,
                restTimeInSeconds: exercise.restTimeInSeconds,
              })),
            })),
          ).map((day) => ({
            ...day,
            coverImageUrl: day.coverImageUrl ?? undefined,
          })),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}

//backend/src/usecases/UpdateWorkoutSession.ts
import {
  InvalidWorkoutSessionCompletionError,
  NotFoundError,
  WorkoutSessionAlreadyCompletedError,
} from "../errors/index.js";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
  sessionId: string;
  completedAt: string;
}

interface OutputDto {
  id: string;
  startedAt: string;
  completedAt: string;
}

function parseCompletedAt(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new InvalidWorkoutSessionCompletionError(
      "completedAt must be a valid ISO datetime",
    );
  }

  return parsedDate;
}

export class UpdateWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    const completedAt = parseCompletedAt(dto.completedAt);

    return prisma.$transaction(
      async (tx) => {
        const workoutPlan = await tx.workoutPlan.findUnique({
          where: { id: dto.workoutPlanId },
        });

        if (!workoutPlan || workoutPlan.userId !== dto.userId) {
          throw new NotFoundError("Workout plan not found");
        }

        const workoutDay = await tx.workoutDay.findFirst({
          where: {
            id: dto.workoutDayId,
            workoutPlanId: dto.workoutPlanId,
          },
        });

        if (!workoutDay) {
          throw new NotFoundError("Workout day not found");
        }

        await tx.$queryRaw`
          SELECT id
          FROM "WorkoutSession"
          WHERE id = ${dto.sessionId}
          FOR UPDATE
        `;

        const session = await tx.workoutSession.findFirst({
          where: {
            id: dto.sessionId,
            workoutDayId: dto.workoutDayId,
          },
        });

        if (!session) {
          throw new NotFoundError("Workout session not found");
        }

        if (!session.startedAt) {
          throw new InvalidWorkoutSessionCompletionError(
            "Session must be started before completion",
          );
        }

        if (session.completeAt) {
          throw new WorkoutSessionAlreadyCompletedError(
            "Workout session has already been completed",
          );
        }

        if (completedAt.getTime() < session.startedAt.getTime()) {
          throw new InvalidWorkoutSessionCompletionError(
            "completedAt cannot be earlier than startedAt",
          );
        }

        const now = new Date();
        const fiveMinutesInMs = 5 * 60 * 1000;

        if (completedAt.getTime() > now.getTime() + fiveMinutesInMs) {
          throw new InvalidWorkoutSessionCompletionError(
            "completedAt cannot be too far in the future",
          );
        }

        const updatedSession = await tx.workoutSession.update({
          where: { id: dto.sessionId },
          data: { completeAt: completedAt },
        });

        return {
          id: updatedSession.id,
          startedAt: updatedSession.startedAt.toISOString(),
          completedAt: updatedSession.completeAt!.toISOString(),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}

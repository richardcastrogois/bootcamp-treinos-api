//backend/src/usecases/StartWorkoutSession.ts
import {
  NotFoundError,
  SessionAlreadyStartedError,
  WorkoutDayIsRestError,
  WorkoutPlanNotActiveError,
} from "../errors/index.js";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

interface OutputDto {
  userWorkoutSessionId: string;
}

export class StartWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    return prisma.$transaction(
      async (tx) => {
        const workoutPlan = await tx.workoutPlan.findUnique({
          where: { id: dto.workoutPlanId },
        });

        if (!workoutPlan || workoutPlan.userId !== dto.userId) {
          throw new NotFoundError("Workout plan not found");
        }

        if (!workoutPlan.isActive) {
          throw new WorkoutPlanNotActiveError("Workout plan is not active");
        }

        await tx.$queryRaw`
          SELECT id
          FROM "WorkoutDay"
          WHERE id = ${dto.workoutDayId}
          FOR UPDATE
        `;

        const workoutDay = await tx.workoutDay.findFirst({
          where: {
            id: dto.workoutDayId,
            workoutPlanId: dto.workoutPlanId,
          },
        });

        if (!workoutDay) {
          throw new NotFoundError("Workout day not found");
        }

        if (workoutDay.isRest) {
          throw new WorkoutDayIsRestError(
            "Cannot start a workout session on a rest day",
          );
        }

        const existingOpenSession = await tx.workoutSession.findFirst({
          where: {
            workoutDayId: dto.workoutDayId,
            completeAt: null,
          },
          orderBy: {
            startedAt: "desc",
          },
        });

        if (existingOpenSession) {
          throw new SessionAlreadyStartedError(
            "A session is already open for this workout day",
          );
        }

        const session = await tx.workoutSession.create({
          data: {
            workoutDayId: dto.workoutDayId,
            startedAt: new Date(),
          },
        });

        return {
          userWorkoutSessionId: session.id,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}

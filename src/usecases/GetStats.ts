//backend/src/usecases/GetStats.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { InvalidDateRangeError, NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";
import { calculateWorkoutStreak } from "../lib/workout-streak.js";

dayjs.extend(utc);

interface InputDto {
  userId: string;
  from: string;
  to: string;
}

interface OutputDto {
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

function parseIsoDate(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidDateRangeError(`${fieldName} must be a valid ISO date`);
  }

  const parsed = dayjs.utc(value);

  if (!parsed.isValid()) {
    throw new InvalidDateRangeError(`${fieldName} must be a valid ISO date`);
  }

  return parsed;
}

export class GetStats {
  async execute(dto: InputDto): Promise<OutputDto> {
    const fromDate = parseIsoDate(dto.from, "from").startOf("day");
    const toDate = parseIsoDate(dto.to, "to").endOf("day");

    if (fromDate.isAfter(toDate)) {
      throw new InvalidDateRangeError("from must be less than or equal to to");
    }

    const rangeInDays = toDate
      .startOf("day")
      .diff(fromDate.startOf("day"), "day");

    if (rangeInDays > 366) {
      throw new InvalidDateRangeError(
        "Date range cannot be greater than 366 days",
      );
    }

    const workoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: dto.userId,
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        workoutDays: {
          select: {
            weekDay: true,
            isRest: true,
          },
        },
      },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Active workout plan not found");
    }

    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlanId: workoutPlan.id,
        },
        startedAt: {
          gte: fromDate.toDate(),
          lte: toDate.toDate(),
        },
      },
      select: {
        startedAt: true,
        completeAt: true,
      },
    });

    const consistencyByDay: Record<
      string,
      { workoutDayCompleted: boolean; workoutDayStarted: boolean }
    > = {};

    for (
      let day = fromDate.startOf("day");
      day.isBefore(toDate.startOf("day")) || day.isSame(toDate.startOf("day"));
      day = day.add(1, "day")
    ) {
      const dateKey = day.format("YYYY-MM-DD");

      consistencyByDay[dateKey] = {
        workoutDayCompleted: false,
        workoutDayStarted: false,
      };
    }

    for (const session of sessions) {
      const dateKey = dayjs.utc(session.startedAt).format("YYYY-MM-DD");

      if (!consistencyByDay[dateKey]) {
        consistencyByDay[dateKey] = {
          workoutDayCompleted: false,
          workoutDayStarted: false,
        };
      }

      consistencyByDay[dateKey].workoutDayStarted = true;

      if (session.completeAt !== null) {
        consistencyByDay[dateKey].workoutDayCompleted = true;
      }
    }

    const completedSessions = sessions.filter(
      (session) => session.completeAt !== null,
    );

    const completedWorkoutsCount = completedSessions.length;
    const conclusionRate =
      sessions.length > 0 ? completedWorkoutsCount / sessions.length : 0;

    const totalTimeInSeconds = completedSessions.reduce((total, session) => {
      const start = dayjs.utc(session.startedAt);
      const end = dayjs.utc(session.completeAt!);

      return total + end.diff(start, "second");
    }, 0);

    const completedSessionsForStreak = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlanId: workoutPlan.id,
        },
        completeAt: {
          not: null,
        },
        startedAt: {
          lte: dayjs.utc().endOf("day").toDate(),
        },
      },
      select: {
        startedAt: true,
      },
    });

    const completedDates = new Set(
      completedSessionsForStreak.map((session) =>
        dayjs.utc(session.startedAt).format("YYYY-MM-DD"),
      ),
    );

    const streakReferenceDate = dayjs.utc().endOf("day").isBefore(toDate)
      ? dayjs.utc().endOf("day")
      : toDate;

    const workoutStreak = calculateWorkoutStreak({
      completedDates,
      workoutDays: workoutPlan.workoutDays.map((day) => ({
        weekDay: day.weekDay,
        isRest: day.isRest,
      })),
      currentDate: streakReferenceDate,
    });

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  }
}

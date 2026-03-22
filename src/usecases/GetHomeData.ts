//backend/src/usecases/GetHomeData.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { InvalidDateRangeError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";
import { calculateWorkoutStreak } from "../lib/workout-streak.js";

dayjs.extend(utc);

const WEEKDAY_MAP: Record<number, WeekDay> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

interface InputDto {
  userId: string;
  date: string;
}

interface OutputDto {
  activeWorkoutPlanId?: string;
  todayWorkoutDay?: {
    workoutPlanId: string;
    id: string;
    name: string;
    isRest: boolean;
    weekDay: WeekDay;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string;
    exercisesCount: number;
  };
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidDateRangeError("date must be a valid ISO date");
  }

  const parsed = dayjs.utc(value);

  if (!parsed.isValid()) {
    throw new InvalidDateRangeError("date must be a valid ISO date");
  }

  return parsed.startOf("day");
}

export class GetHomeData {
  async execute(dto: InputDto): Promise<OutputDto> {
    const currentDate = parseIsoDate(dto.date);

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
            id: true,
            name: true,
            isRest: true,
            weekDay: true,
            estimatedDurationInSeconds: true,
            coverImageUrl: true,
            _count: {
              select: {
                exercises: true,
              },
            },
          },
        },
      },
    });

    const todayWeekDay = WEEKDAY_MAP[currentDate.day()];
    const todayWorkoutDay = workoutPlan?.workoutDays.find(
      (day) => day.weekDay === todayWeekDay,
    );

    const weekStart = currentDate.day(0).startOf("day");
    const weekEnd = currentDate.day(6).endOf("day");

    const consistencyByDay: Record<
      string,
      { workoutDayCompleted: boolean; workoutDayStarted: boolean }
    > = {};

    for (let index = 0; index < 7; index++) {
      const dateKey = weekStart.add(index, "day").format("YYYY-MM-DD");

      consistencyByDay[dateKey] = {
        workoutDayCompleted: false,
        workoutDayStarted: false,
      };
    }

    let workoutStreak = 0;

    if (!workoutPlan) {
      return {
        activeWorkoutPlanId: undefined,
        todayWorkoutDay: undefined,
        workoutStreak,
        consistencyByDay,
      };
    }

    const weekSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlanId: workoutPlan.id,
        },
        startedAt: {
          gte: weekStart.toDate(),
          lte: weekEnd.toDate(),
        },
      },
      select: {
        startedAt: true,
        completeAt: true,
      },
    });

    for (const session of weekSessions) {
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

    const completedSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlanId: workoutPlan.id,
        },
        completeAt: {
          not: null,
        },
        startedAt: {
          lte: currentDate.endOf("day").toDate(),
        },
      },
      select: {
        startedAt: true,
      },
    });

    const completedDates = new Set(
      completedSessions.map((session) =>
        dayjs.utc(session.startedAt).format("YYYY-MM-DD"),
      ),
    );

    workoutStreak = calculateWorkoutStreak({
      completedDates,
      workoutDays: workoutPlan.workoutDays.map((day) => ({
        weekDay: day.weekDay,
        isRest: day.isRest,
      })),
      currentDate,
    });

    return {
      activeWorkoutPlanId: workoutPlan.id,
      todayWorkoutDay: todayWorkoutDay
        ? {
            workoutPlanId: workoutPlan.id,
            id: todayWorkoutDay.id,
            name: todayWorkoutDay.name,
            isRest: todayWorkoutDay.isRest,
            weekDay: todayWorkoutDay.weekDay,
            estimatedDurationInSeconds:
              todayWorkoutDay.estimatedDurationInSeconds,
            coverImageUrl: todayWorkoutDay.coverImageUrl ?? undefined,
            exercisesCount: todayWorkoutDay._count.exercises,
          }
        : undefined,
      workoutStreak,
      consistencyByDay,
    };
  }
}

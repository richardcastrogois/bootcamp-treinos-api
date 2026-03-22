//backend/src/lib/workout-streak.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { WeekDay } from "../generated/prisma/enums.js";

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

interface WorkoutDayForStreak {
  weekDay: WeekDay;
  isRest: boolean;
}

interface CalculateWorkoutStreakInput {
  completedDates: Set<string>;
  workoutDays: WorkoutDayForStreak[];
  currentDate: dayjs.Dayjs;
}

export function calculateWorkoutStreak({
  completedDates,
  workoutDays,
  currentDate,
}: CalculateWorkoutStreakInput) {
  const planWeekDays = new Set(workoutDays.map((day) => day.weekDay));
  const restWeekDays = new Set(
    workoutDays.filter((day) => day.isRest).map((day) => day.weekDay),
  );

  let streak = 0;
  let day = currentDate.utc().startOf("day");

  for (let index = 0; index < 365; index++) {
    const weekDay = WEEKDAY_MAP[day.day()];
    const dateKey = day.format("YYYY-MM-DD");

    if (!planWeekDays.has(weekDay)) {
      day = day.subtract(1, "day");
      continue;
    }

    if (restWeekDays.has(weekDay)) {
      streak++;
      day = day.subtract(1, "day");
      continue;
    }

    if (completedDates.has(dateKey)) {
      streak++;
      day = day.subtract(1, "day");
      continue;
    }

    break;
  }

  return streak;
}

CREATE UNIQUE INDEX IF NOT EXISTS "workout_plan_one_active_per_user_idx"
ON "WorkoutPlan" ("userId")
WHERE "isActive" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "workout_session_one_open_per_day_idx"
ON "WorkoutSession" ("workoutDayId")
WHERE "completeAt" IS NULL;

CREATE INDEX IF NOT EXISTS "mobile_refresh_token_active_user_idx"
ON "mobile_refresh_token" ("userId", "expiresAt")
WHERE "revokedAt" IS NULL;
-- DropIndex
DROP INDEX "WorkoutDay_workoutPlanId_weekDay_idx";

-- DropIndex
DROP INDEX "WorkoutExercise_workoutDayId_order_idx";

-- DropIndex
DROP INDEX "WorkoutPlan_userId_createdAt_idx";

-- CreateTable
CREATE TABLE "mobile_refresh_token" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mobile_refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mobile_refresh_token_tokenHash_key" ON "mobile_refresh_token"("tokenHash");

-- CreateIndex
CREATE INDEX "mobile_refresh_token_userId_idx" ON "mobile_refresh_token"("userId");

-- CreateIndex
CREATE INDEX "mobile_refresh_token_expiresAt_idx" ON "mobile_refresh_token"("expiresAt");

-- CreateIndex
CREATE INDEX "mobile_refresh_token_userId_revokedAt_idx" ON "mobile_refresh_token"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "WorkoutDay_workoutPlanId_idx" ON "WorkoutDay"("workoutPlanId");

-- CreateIndex
CREATE INDEX "WorkoutExercise_workoutDayId_idx" ON "WorkoutExercise"("workoutDayId");

-- AddForeignKey
ALTER TABLE "mobile_refresh_token" ADD CONSTRAINT "mobile_refresh_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

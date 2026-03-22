/*
  Warnings:

  - A unique constraint covering the columns `[workoutPlanId,weekDay]` on the table `WorkoutDay` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[workoutDayId,order]` on the table `WorkoutExercise` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "WorkoutDay_workoutPlanId_weekDay_idx" ON "WorkoutDay"("workoutPlanId", "weekDay");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutDay_workoutPlanId_weekDay_key" ON "WorkoutDay"("workoutPlanId", "weekDay");

-- CreateIndex
CREATE INDEX "WorkoutExercise_workoutDayId_order_idx" ON "WorkoutExercise"("workoutDayId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExercise_workoutDayId_order_key" ON "WorkoutExercise"("workoutDayId", "order");

-- CreateIndex
CREATE INDEX "WorkoutPlan_userId_isActive_idx" ON "WorkoutPlan"("userId", "isActive");

-- CreateIndex
CREATE INDEX "WorkoutPlan_userId_createdAt_idx" ON "WorkoutPlan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_workoutDayId_completeAt_idx" ON "WorkoutSession"("workoutDayId", "completeAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_workoutDayId_startedAt_idx" ON "WorkoutSession"("workoutDayId", "startedAt");

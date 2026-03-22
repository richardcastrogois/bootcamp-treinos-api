//backend/src/errors/index.ts
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class WorkoutPlanNotActiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkoutPlanNotActiveError";
  }
}

export class SessionAlreadyStartedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionAlreadyStartedError";
  }
}

export class InvalidWorkoutPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWorkoutPlanError";
  }
}

export class WorkoutDayIsRestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkoutDayIsRestError";
  }
}

export class WorkoutSessionAlreadyCompletedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkoutSessionAlreadyCompletedError";
  }
}

export class InvalidWorkoutSessionCompletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWorkoutSessionCompletionError";
  }
}

export class InvalidUserTrainDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUserTrainDataError";
  }
}

export class InvalidDateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDateRangeError";
  }
}

export class InvalidMobileAuthTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMobileAuthTokenError";
  }
}

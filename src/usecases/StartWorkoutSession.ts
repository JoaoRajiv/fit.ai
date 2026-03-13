import {
  ForbiddenError,
  NotFoundError,
  WorkoutPlanNotActiveError,
  WorkoutSessionAlreadyStartedError,
} from "../errors/index.js";
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
    return prisma.$transaction(async (tx) => {
      const workoutPlan = await tx.workoutPlan.findUnique({
        where: { id: dto.workoutPlanId },
        select: {
          id: true,
          userId: true,
          isActive: true,
        },
      });

      if (!workoutPlan) {
        throw new NotFoundError("Workout plan not found");
      }

      if (workoutPlan.userId !== dto.userId) {
        throw new ForbiddenError("You do not have access to this workout plan");
      }

      if (!workoutPlan.isActive) {
        throw new WorkoutPlanNotActiveError("Workout plan is not active");
      }

      const workoutDay = await tx.workoutDay.findUnique({
        where: { id: dto.workoutDayId },
        select: {
          id: true,
          workoutPlanId: true,
        },
      });

      if (!workoutDay || workoutDay.workoutPlanId !== dto.workoutPlanId) {
        throw new NotFoundError("Workout day not found");
      }

      const existingSession = await tx.workoutSession.findFirst({
        where: {
          workoutDayId: dto.workoutDayId,
        },
        select: {
          id: true,
        },
      });

      if (existingSession) {
        throw new WorkoutSessionAlreadyStartedError(
          "Workout session already started for this day",
        );
      }

      const workoutSession = await tx.workoutSession.create({
        data: {
          workoutDayId: dto.workoutDayId,
          startedAt: new Date(),
        },
        select: {
          id: true,
        },
      });

      return {
        userWorkoutSessionId: workoutSession.id,
      };
    });
  }
}

//backend/src/usecases/UpsertUserTrainData.ts
import { InvalidUserTrainDataError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number;
}

interface OutputDto {
  userId: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number;
}

function assertValidTrainData(dto: InputDto) {
  if (!Number.isInteger(dto.weightInGrams) || dto.weightInGrams < 1) {
    throw new InvalidUserTrainDataError(
      "weightInGrams must be an integer greater than 0",
    );
  }

  if (
    !Number.isInteger(dto.heightInCentimeters) ||
    dto.heightInCentimeters < 1
  ) {
    throw new InvalidUserTrainDataError(
      "heightInCentimeters must be an integer greater than 0",
    );
  }

  if (!Number.isInteger(dto.age) || dto.age < 1) {
    throw new InvalidUserTrainDataError(
      "age must be an integer greater than 0",
    );
  }

  if (
    !Number.isInteger(dto.bodyFatPercentage) ||
    dto.bodyFatPercentage < 0 ||
    dto.bodyFatPercentage > 100
  ) {
    throw new InvalidUserTrainDataError(
      "bodyFatPercentage must be an integer between 0 and 100",
    );
  }
}

export class UpsertUserTrainData {
  async execute(dto: InputDto): Promise<OutputDto> {
    assertValidTrainData(dto);

    const user = await prisma.user.update({
      where: { id: dto.userId },
      data: {
        weightInGrams: dto.weightInGrams,
        heightInCentimeters: dto.heightInCentimeters,
        age: dto.age,
        bodyFatPercentage: dto.bodyFatPercentage,
      },
    });

    return {
      userId: user.id,
      weightInGrams: user.weightInGrams!,
      heightInCentimeters: user.heightInCentimeters!,
      age: user.age!,
      bodyFatPercentage: user.bodyFatPercentage!,
    };
  }
}

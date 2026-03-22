//backend/src/lib/manual-plan-builder.ts
import { WeekDay } from "../generated/prisma/enums.js";

export type ManualGoal = "hypertrophy" | "strength" | "weight_loss" | "health";

export type ManualExperienceLevel = "beginner" | "intermediate" | "advanced";

type TemplateFocus = "upper" | "lower";

type TemplateDay = {
  name: string;
  focus: TemplateFocus;
  exercises: string[];
};

type ManualPlanInput = {
  goal: ManualGoal;
  daysPerWeek: number;
  experienceLevel: ManualExperienceLevel;
  sessionDurationInMinutes: number;
};

export const UPPER_COVER_URLS = [
  "https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO3y8pQ6GBg8iqe9pP2JrHjwd1nfKtVSQskI0v",
  "https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOW3fJmqZe4yoUcwvRPQa8kmFprzNiC30hqftL",
] as const;

export const LOWER_COVER_URLS = [
  "https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOgCHaUgNGronCvXmSzAMs1N3KgLdE5yHT6Ykj",
  "https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO85RVu3morROwZk5NPhs1jzH7X8TyEvLUCGxY",
] as const;

const ALL_WEEK_DAYS: WeekDay[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function getTrainingDays(daysPerWeek: number): WeekDay[] {
  switch (daysPerWeek) {
    case 1:
      return ["MONDAY"];
    case 2:
      return ["MONDAY", "THURSDAY"];
    case 3:
      return ["MONDAY", "WEDNESDAY", "FRIDAY"];
    case 4:
      return ["MONDAY", "TUESDAY", "THURSDAY", "FRIDAY"];
    case 5:
      return ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
    case 6:
      return [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
      ];
    default:
      return ["MONDAY", "WEDNESDAY", "FRIDAY"];
  }
}

function getTemplates(daysPerWeek: number): TemplateDay[] {
  switch (daysPerWeek) {
    case 1:
      return [
        {
          name: "Full Body",
          focus: "upper",
          exercises: [
            "Agachamento livre",
            "Supino reto",
            "Puxada frontal",
            "Desenvolvimento com halteres",
            "Levantamento terra romeno",
            "Rosca direta",
            "Tríceps pulley",
          ],
        },
      ];

    case 2:
      return [
        {
          name: "Full Body A",
          focus: "upper",
          exercises: [
            "Agachamento livre",
            "Supino reto",
            "Remada curvada",
            "Desenvolvimento com halteres",
            "Cadeira extensora",
            "Rosca direta",
          ],
        },
        {
          name: "Full Body B",
          focus: "lower",
          exercises: [
            "Leg press",
            "Puxada frontal",
            "Levantamento terra romeno",
            "Elevação lateral",
            "Mesa flexora",
            "Tríceps pulley",
          ],
        },
      ];

    case 3:
      return [
        {
          name: "A - Peito e Tríceps",
          focus: "upper",
          exercises: [
            "Supino reto",
            "Supino inclinado com halteres",
            "Crucifixo máquina",
            "Tríceps pulley",
            "Tríceps francês",
            "Abdominal infra",
          ],
        },
        {
          name: "B - Costas e Bíceps",
          focus: "upper",
          exercises: [
            "Puxada frontal",
            "Remada baixa",
            "Remada unilateral",
            "Rosca direta",
            "Rosca martelo",
            "Prancha",
          ],
        },
        {
          name: "C - Pernas e Ombros",
          focus: "lower",
          exercises: [
            "Agachamento livre",
            "Leg press",
            "Mesa flexora",
            "Desenvolvimento com halteres",
            "Elevação lateral",
            "Panturrilha em pé",
          ],
        },
      ];

    case 4:
      return [
        {
          name: "Upper A",
          focus: "upper",
          exercises: [
            "Supino reto",
            "Puxada frontal",
            "Remada baixa",
            "Desenvolvimento com halteres",
            "Rosca direta",
            "Tríceps pulley",
          ],
        },
        {
          name: "Lower A",
          focus: "lower",
          exercises: [
            "Agachamento livre",
            "Leg press",
            "Mesa flexora",
            "Cadeira extensora",
            "Panturrilha sentado",
            "Abdominal infra",
          ],
        },
        {
          name: "Upper B",
          focus: "upper",
          exercises: [
            "Supino inclinado com halteres",
            "Remada curvada",
            "Puxada articulada",
            "Elevação lateral",
            "Rosca martelo",
            "Tríceps testa",
          ],
        },
        {
          name: "Lower B",
          focus: "lower",
          exercises: [
            "Levantamento terra romeno",
            "Afundo",
            "Cadeira extensora",
            "Mesa flexora",
            "Panturrilha em pé",
            "Prancha",
          ],
        },
      ];

    case 5:
      return [
        {
          name: "Push",
          focus: "upper",
          exercises: [
            "Supino reto",
            "Supino inclinado com halteres",
            "Desenvolvimento com halteres",
            "Elevação lateral",
            "Tríceps pulley",
            "Tríceps francês",
          ],
        },
        {
          name: "Pull",
          focus: "upper",
          exercises: [
            "Puxada frontal",
            "Remada baixa",
            "Remada unilateral",
            "Face pull",
            "Rosca direta",
            "Rosca martelo",
          ],
        },
        {
          name: "Legs",
          focus: "lower",
          exercises: [
            "Agachamento livre",
            "Leg press",
            "Mesa flexora",
            "Cadeira extensora",
            "Panturrilha em pé",
            "Abdominal infra",
          ],
        },
        {
          name: "Upper",
          focus: "upper",
          exercises: [
            "Supino máquina",
            "Puxada articulada",
            "Remada cavalinho",
            "Desenvolvimento máquina",
            "Rosca Scott",
            "Tríceps corda",
          ],
        },
        {
          name: "Lower",
          focus: "lower",
          exercises: [
            "Levantamento terra romeno",
            "Afundo búlgaro",
            "Mesa flexora",
            "Cadeira extensora",
            "Panturrilha sentado",
            "Prancha",
          ],
        },
      ];

    case 6:
      return [
        {
          name: "Push A",
          focus: "upper",
          exercises: [
            "Supino reto",
            "Supino inclinado com halteres",
            "Desenvolvimento com halteres",
            "Elevação lateral",
            "Tríceps pulley",
            "Tríceps francês",
          ],
        },
        {
          name: "Pull A",
          focus: "upper",
          exercises: [
            "Puxada frontal",
            "Remada baixa",
            "Remada unilateral",
            "Face pull",
            "Rosca direta",
            "Rosca martelo",
          ],
        },
        {
          name: "Legs A",
          focus: "lower",
          exercises: [
            "Agachamento livre",
            "Leg press",
            "Mesa flexora",
            "Cadeira extensora",
            "Panturrilha em pé",
            "Abdominal infra",
          ],
        },
        {
          name: "Push B",
          focus: "upper",
          exercises: [
            "Supino máquina",
            "Crucifixo máquina",
            "Desenvolvimento máquina",
            "Elevação lateral",
            "Tríceps corda",
            "Tríceps testa",
          ],
        },
        {
          name: "Pull B",
          focus: "upper",
          exercises: [
            "Puxada articulada",
            "Remada cavalinho",
            "Pulldown braço reto",
            "Face pull",
            "Rosca Scott",
            "Rosca inclinada",
          ],
        },
        {
          name: "Legs B",
          focus: "lower",
          exercises: [
            "Levantamento terra romeno",
            "Afundo",
            "Mesa flexora",
            "Cadeira extensora",
            "Panturrilha sentado",
            "Prancha",
          ],
        },
      ];

    default:
      return getTemplates(3);
  }
}

function getSets(goal: ManualGoal, level: ManualExperienceLevel): number {
  if (goal === "strength") {
    if (level === "advanced") return 5;
    if (level === "intermediate") return 4;
    return 4;
  }

  if (level === "advanced") return 4;
  return 3;
}

function getReps(goal: ManualGoal): number {
  switch (goal) {
    case "strength":
      return 6;
    case "weight_loss":
      return 15;
    case "health":
      return 12;
    case "hypertrophy":
    default:
      return 10;
  }
}

function getRestTime(goal: ManualGoal): number {
  switch (goal) {
    case "strength":
      return 120;
    case "weight_loss":
      return 45;
    case "health":
      return 60;
    case "hypertrophy":
    default:
      return 75;
  }
}

function getMaxExercises(level: ManualExperienceLevel): number {
  switch (level) {
    case "beginner":
      return 5;
    case "intermediate":
      return 6;
    case "advanced":
      return 7;
  }
}

function getCoverImageUrl(focus: TemplateFocus, index: number): string {
  if (focus === "lower") {
    return LOWER_COVER_URLS[index % LOWER_COVER_URLS.length];
  }

  return UPPER_COVER_URLS[index % UPPER_COVER_URLS.length];
}

function getPlanName(goal: ManualGoal, daysPerWeek: number): string {
  const goalLabelMap: Record<ManualGoal, string> = {
    hypertrophy: "Hipertrofia",
    strength: "Força",
    weight_loss: "Emagrecimento",
    health: "Saúde",
  };

  return `Plano ${goalLabelMap[goal]} ${daysPerWeek}x`;
}

export function buildManualWorkoutPlan(input: ManualPlanInput) {
  const trainingDays = getTrainingDays(input.daysPerWeek);
  const templates = getTemplates(input.daysPerWeek);

  let templateIndex = 0;

  return {
    name: getPlanName(input.goal, input.daysPerWeek),
    workoutDays: ALL_WEEK_DAYS.map((weekDay) => {
      const isTrainingDay = trainingDays.includes(weekDay);

      if (!isTrainingDay) {
        return {
          name: "Descanso",
          weekDay,
          isRest: true,
          estimatedDurationInSeconds: 0,
          coverImageUrl: UPPER_COVER_URLS[0],
          exercises: [],
        };
      }

      const template = templates[templateIndex];
      templateIndex += 1;

      const maxExercises = getMaxExercises(input.experienceLevel);
      const exercises = template.exercises.slice(0, maxExercises);

      return {
        name: template.name,
        weekDay,
        isRest: false,
        estimatedDurationInSeconds: input.sessionDurationInMinutes * 60,
        coverImageUrl: getCoverImageUrl(template.focus, templateIndex - 1),
        exercises: exercises.map((exerciseName, index) => ({
          order: index + 1,
          name: exerciseName,
          sets: getSets(input.goal, input.experienceLevel),
          reps: getReps(input.goal),
          restTimeInSeconds: getRestTime(input.goal),
        })),
      };
    }),
  };
}

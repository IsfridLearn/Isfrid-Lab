import { blankNumbers } from "@/lib/grading";
import { languageInfo } from "@/lib/languages";
import type { CodingExercise, ExerciseType, LanguageId, Validation } from "@/lib/types";

/** What the workspace receives: the exercise without its answer key. */
export interface WorkspaceExercise {
  id: string;
  title: string;
  exercise_type: ExerciseType;
  language: LanguageId;
  description: string;
  instructions: string;
  hints: string[];
  template_code: string;
  setup_code: string;
  validation: Validation;
  points: number;
  blankCount: number;
  tests: { id: string; stdin: string; expected_output: string | null; is_hidden: boolean }[];
}

export interface WorkspaceSubmission {
  id: string;
  status: "passed" | "partial" | "failed";
  passed_count: number;
  total_count: number;
  code: string;
  created_at: string;
}

/** Strips solutions, blank answers and hidden expected outputs before an exercise is sent to the browser. */
export function toWorkspaceExercise(exercise: CodingExercise): WorkspaceExercise {
  const inBrowser = languageInfo(exercise.language).runtime === "browser";
  return {
    id: exercise.id,
    title: exercise.title,
    exercise_type: exercise.exercise_type,
    language: exercise.language,
    description: exercise.description,
    instructions: exercise.instructions,
    hints: exercise.hints ?? [],
    template_code: exercise.template_code,
    setup_code: exercise.setup_code,
    validation: exercise.validation,
    points: exercise.points,
    blankCount: blankNumbers(exercise.template_code).length,
    tests:
      exercise.validation === "tests"
        ? [...(exercise.coding_test_cases ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((t) => ({
              id: t.id,
              stdin: t.is_hidden && !inBrowser ? "" : t.stdin,
              expected_output: t.is_hidden ? null : t.expected_output,
              is_hidden: t.is_hidden,
            }))
        : [],
  };
}

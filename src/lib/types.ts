export type StudyMode = "multiple_choice" | "identification" | "coding";
export type LanguageId = "c" | "cpp" | "java" | "python" | "javascript" | "php" | "sql";
export type ExerciseType =
  | "missing_code"
  | "missing_variables"
  | "missing_functions"
  | "missing_statements"
  | "missing_blocks"
  | "predict_output"
  | "debug";
export type Validation = "blanks" | "output" | "tests" | "solution";

export interface AcademicProgram {
  id: string;
  code: string;
  name: string;
  is_technical: boolean;
  allows_custom_name: boolean;
  sort_order: number;
}

export interface Profile {
  id: string;
  full_name: string;
  program_id: string | null;
  custom_program: string | null;
  onboarded: boolean;
  weekly_goal: number;
  timezone: string;
  created_at: string;
  program: AcademicProgram | null;
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  color: string;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  subject_id: string | null;
  title: string;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  page_count: number;
  char_count: number;
  created_at: string;
}

export interface StudySet {
  id: string;
  subject_id: string | null;
  document_id: string | null;
  title: string;
  description: string | null;
  mode: StudyMode;
  time_limit_minutes: number | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnswerOption {
  id: string;
  body: string;
  is_correct: boolean;
  position: number;
}

export interface Question {
  id: string;
  set_id: string;
  type: "multiple_choice" | "identification";
  prompt: string;
  explanation: string | null;
  source_document_id: string | null;
  source_page: number | null;
  position: number;
  points: number;
  answer_options: AnswerOption[];
  accepted_answers: { id: string; body: string }[];
}

export interface Blank {
  n: number;
  answers: string[];
}

export interface TestCase {
  id: string;
  stdin: string;
  expected_output: string;
  is_hidden: boolean;
  position: number;
}

export interface CodingExercise {
  id: string;
  set_id: string;
  title: string;
  exercise_type: ExerciseType;
  language: LanguageId;
  description: string;
  instructions: string;
  hints: string[];
  template_code: string;
  solution_code: string;
  setup_code: string;
  validation: Validation;
  blanks: Blank[];
  expected_output: string;
  position: number;
  points: number;
  coding_test_cases: TestCase[];
}

export interface AttemptItem {
  id: string;
  options?: string[];
}

export interface Attempt {
  id: string;
  set_id: string | null;
  subject_id: string | null;
  set_title: string;
  mode: StudyMode;
  status: "in_progress" | "completed";
  item_order: AttemptItem[];
  time_limit_seconds: number | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  item_count: number;
  correct_count: number;
  total_points: number;
  earned_points: number;
  score_percent: number;
}

export interface AttemptAnswer {
  id: string;
  question_id: string | null;
  exercise_id: string | null;
  position: number;
  prompt: string;
  response: unknown;
  correct_answer: unknown;
  is_correct: boolean;
  points_earned: number;
  points_possible: number;
}

export interface ProgressDay {
  activity_date: string;
  assessments_completed: number;
  items_answered: number;
  items_correct: number;
  coding_completed: number;
}

/** One executed test (or the single check for non-test validations). */
export interface CheckResult {
  label: string;
  passed: boolean;
  hidden?: boolean;
  stdin?: string;
  expected?: string;
  actual?: string;
  error?: string;
}

export interface SubmissionResult {
  status: "passed" | "partial" | "failed";
  score: number;
  passed: number;
  total: number;
  checks: CheckResult[];
  message?: string;
}

export interface Submission {
  id: string;
  exercise_id: string;
  language: string;
  code: string;
  status: "passed" | "partial" | "failed";
  score: number;
  passed_count: number;
  total_count: number;
  results: SubmissionResult;
  created_at: string;
}

export type FormState = { error?: string; message?: string } | null;

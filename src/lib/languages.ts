import type { ExerciseType, LanguageId, StudyMode, Validation } from "@/lib/types";

export interface LanguageInfo {
  id: LanguageId;
  label: string;
  monaco: string;
  runtime: "browser" | "remote";
  piston: string;
  judge0Id: number;
  fileName: string;
  sample: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { id: "python", label: "Python", monaco: "python", runtime: "browser", piston: "python", judge0Id: 71, fileName: "main.py", sample: 'name = input()\nprint("Hello, " + name)\n' },
  { id: "javascript", label: "JavaScript", monaco: "javascript", runtime: "browser", piston: "javascript", judge0Id: 63, fileName: "main.js", sample: 'const name = readline();\nconsole.log("Hello, " + name);\n' },
  { id: "sql", label: "SQL", monaco: "sql", runtime: "browser", piston: "sqlite3", judge0Id: 82, fileName: "query.sql", sample: "SELECT name FROM students ORDER BY name;\n" },
  { id: "c", label: "C", monaco: "c", runtime: "remote", piston: "c", judge0Id: 50, fileName: "main.c", sample: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, world\\n");\n    return 0;\n}\n' },
  { id: "cpp", label: "C++", monaco: "cpp", runtime: "remote", piston: "c++", judge0Id: 54, fileName: "main.cpp", sample: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, world" << std::endl;\n    return 0;\n}\n' },
  { id: "java", label: "Java", monaco: "java", runtime: "remote", piston: "java", judge0Id: 62, fileName: "Main.java", sample: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, world");\n    }\n}\n' },
  { id: "php", label: "PHP", monaco: "php", runtime: "remote", piston: "php", judge0Id: 68, fileName: "main.php", sample: '<?php\necho "Hello, world\\n";\n' },
];

export const languageInfo = (id: string) => LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];

export const EXERCISE_TYPES: { id: ExerciseType; label: string; hint: string; defaultValidation: Validation }[] = [
  { id: "missing_code", label: "Complete missing code", hint: "Blank out any part of a working program.", defaultValidation: "blanks" },
  { id: "missing_variables", label: "Complete missing variables", hint: "Blank out variable names or values.", defaultValidation: "blanks" },
  { id: "missing_functions", label: "Complete missing functions", hint: "Blank out a function name, call or signature.", defaultValidation: "blanks" },
  { id: "missing_statements", label: "Complete missing statements", hint: "Blank out whole statements.", defaultValidation: "blanks" },
  { id: "missing_blocks", label: "Complete missing code blocks", hint: "Blank out a loop body, branch or function body.", defaultValidation: "blanks" },
  { id: "predict_output", label: "Predict program output", hint: "Show a program; the student types what it prints.", defaultValidation: "output" },
  { id: "debug", label: "Debug existing code", hint: "Give broken code; the student fixes it.", defaultValidation: "tests" },
];

export const exerciseTypeLabel = (id: string) => EXERCISE_TYPES.find((t) => t.id === id)?.label ?? id;

export const VALIDATIONS: { id: Validation; label: string; description: string }[] = [
  { id: "blanks", label: "Match the blanks", description: "Each blank is compared with your accepted answers. No code is executed." },
  { id: "output", label: "Match the output", description: "The student types the program's output; it is compared with the expected output." },
  { id: "tests", label: "Run test cases", description: "The student's code is executed against your inputs and expected outputs." },
  { id: "solution", label: "Match the solution", description: "The whole program is compared with your reference solution. No code is executed." },
];

export const MODES: { id: StudyMode; label: string; short: string; description: string }[] = [
  { id: "multiple_choice", label: "Multiple Choice", short: "MC", description: "Write a question and its choices, then mark the correct one." },
  { id: "identification", label: "Identification", short: "ID", description: "Write a question and the answers you will accept. Checked without case sensitivity." },
  { id: "coding", label: "Fill in the Code", short: "Code", description: "Blank out code, predict output or debug programs in the CodeLab workspace." },
];

export const modeLabel = (mode: string) => MODES.find((m) => m.id === mode)?.label ?? mode;

export const SUBJECT_COLORS = ["teal", "blue", "violet", "rose", "amber", "slate"] as const;

export const subjectColorClass: Record<string, string> = {
  teal: "bg-teal-600",
  blue: "bg-blue-600",
  violet: "bg-violet-600",
  rose: "bg-rose-600",
  amber: "bg-amber-500",
  slate: "bg-slate-500",
};

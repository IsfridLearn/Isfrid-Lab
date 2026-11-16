import Link from "next/link";
import { ArrowRight, Check, FileText, Highlighter, ListChecks, PenLine, Terminal, Timer, TrendingUp } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/client-ui";
import { buttonClass } from "@/components/ui";

const FLOW = ["Upload PDF", "Extract text", "Write questions", "Pick a mode", "Take assessment", "Review results"];

const MODES = [
  {
    icon: ListChecks,
    name: "Multiple Choice",
    body: "Write the question and its choices, mark what's right. Question and choice order reshuffle on every attempt so you learn the material, not the positions.",
  },
  {
    icon: PenLine,
    name: "Identification",
    body: "Type the answer from memory. Checking ignores letter case and extra spaces, and each question can accept several correct answers.",
  },
  {
    icon: Terminal,
    name: "Fill in the Code",
    body: "Blank out variables, statements or whole blocks, predict output, or fix broken programs — in a real editor, for seven languages.",
  },
];

const PRINCIPLES = [
  { icon: Highlighter, title: "Your PDFs, your wording", body: "Highlight a passage in the extracted text and turn it straight into a question. Writing the question is half the studying." },
  { icon: Timer, title: "Assessments that feel like exams", body: "Timed or untimed, with question navigation, automatic scoring and a full answer review afterwards." },
  { icon: TrendingUp, title: "Progress you can see", body: "Scores by subject, a study streak, a weekly goal and every past attempt, ready to retake." },
];

function CodePreview() {
  const line = (n: number, content: React.ReactNode) => (
    <div className="flex gap-4">
      <span className="w-4 select-none text-right text-white/25">{n}</span>
      <span>{content}</span>
    </div>
  );
  const blank = (n: number) => <span className="rounded bg-amber-400/20 px-1 text-amber-300">__{n}__</span>;
  return (
    <div className="overflow-hidden rounded-card border border-border bg-code-bg shadow-pop">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs text-white/50">
        <span className="font-mono">binary_search.py</span>
        <span className="hidden sm:inline">Complete missing statements · Python</span>
      </div>
      <div className="px-4 py-4 font-mono text-[13px] leading-6 text-code-fg">
        {line(1, <><span className="text-sky-300">def</span> search(items, target):</>)}
        {line(2, <>&nbsp;&nbsp;lo, hi = 0, {blank(1)}</>)}
        {line(3, <>&nbsp;&nbsp;<span className="text-sky-300">while</span> lo &lt;= hi:</>)}
        {line(4, <>&nbsp;&nbsp;&nbsp;&nbsp;mid = {blank(2)}</>)}
        {line(5, <>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-sky-300">if</span> items[mid] == target:</>)}
        {line(6, <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-sky-300">return</span> mid</>)}
        {line(7, <>&nbsp;&nbsp;&nbsp;&nbsp;{blank(3)}</>)}
      </div>
      <div className="flex items-center gap-4 border-t border-white/10 px-4 py-2.5 font-mono text-xs">
        <span className="text-emerald-400">✓ Blank 1</span>
        <span className="text-emerald-400">✓ Blank 2</span>
        <span className="text-rose-400">✗ Blank 3</span>
        <span className="ml-auto text-white/50">2 / 3 correct</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/" aria-label="ISFRID home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/login" className={buttonClass("ghost")}>
              Log in
            </Link>
            <Link href="/register" className={buttonClass("primary")}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div className="animate-rise">
            <p className="mb-4 text-sm font-medium text-brand-text">Interactive learning and assessment</p>
            <h1 className="text-4xl leading-[1.08] font-semibold text-fg sm:text-[52px]">
              Your knowledge.
              <br />
              Your progress.
              <br />
              Your mastery.
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-fg-muted">
              ISFRID turns the PDFs from your courses into study sets you write yourself — then tests you on them with
              multiple choice, identification and a coding workspace built for programming majors.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className={buttonClass("primary", "lg")}>
                Start studying free <ArrowRight />
              </Link>
              <Link href="/login" className={buttonClass("secondary", "lg")}>
                I have an account
              </Link>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-fg-subtle">
              <Check className="size-4 text-brand-text" /> No AI-generated questions. Every answer key is yours.
            </p>
          </div>
          <div className="animate-rise [animation-delay:120ms]">
            <CodePreview />
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <ol className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-5 px-5 py-8 sm:grid-cols-3 lg:grid-cols-6">
            {FLOW.map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                <span className="font-mono text-xs text-fg-subtle">0{index + 1}</span>
                <span className="text-sm font-medium text-fg">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="max-w-xl text-3xl font-semibold text-fg">Three ways to test what you actually know</h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {MODES.map((mode) => (
              <div key={mode.name}>
                <mode.icon className="size-5 text-brand-text" />
                <h3 className="mt-4 text-base font-semibold text-fg">{mode.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{mode.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-code-bg text-code-fg">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-2">
            <div>
              <p className="font-mono text-xs tracking-widest text-emerald-400 uppercase">ISFRID CodeLab</p>
              <h2 className="mt-4 text-3xl font-semibold text-white">A practice workspace for people who write code</h2>
              <p className="mt-4 max-w-md leading-relaxed text-white/65">
                Available to BSIT, BSCS, BSIS, Software Engineering, Computer Engineering and other technology programs.
                Problem on the left, editor in the middle, console and test results underneath.
              </p>
              <p className="mt-6 font-mono text-sm text-white/50">C · C++ · Java · Python · JavaScript · PHP · SQL</p>
            </div>
            <ul className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              {[
                "Complete missing code",
                "Complete missing variables",
                "Complete missing functions",
                "Complete missing statements",
                "Complete missing code blocks",
                "Predict program output",
                "Debug existing code",
                "Test cases and submission history",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 border-t border-white/10 pt-4 text-white/80">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-10 md:grid-cols-3">
            {PRINCIPLES.map((item) => (
              <div key={item.title}>
                <item.icon className="size-5 text-brand-text" />
                <h3 className="mt-4 text-base font-semibold text-fg">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-20 flex flex-col items-start justify-between gap-6 rounded-card border border-border bg-surface p-8 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-semibold text-fg">Bring one PDF. Leave with a study set.</h2>
              <p className="mt-1 text-sm text-fg-muted">Free to use. Your materials stay private to your account.</p>
            </div>
            <Link href="/register" className={buttonClass("primary", "lg")}>
              <FileText /> Create your account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-fg-subtle">
          <Logo />
          <span>Your knowledge. Your progress. Your mastery.</span>
        </div>
      </footer>
    </div>
  );
}

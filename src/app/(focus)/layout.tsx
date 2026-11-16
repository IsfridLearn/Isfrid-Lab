// Distraction-free layout for assessments and the coding workspace: no sidebar.
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-1 flex-col">{children}</div>;
}

import Link from "next/link";

type LegalDocumentPageProps = {
  eyebrow: string;
  title: string;
  summary: string;
  updatedAt: string;
  sections: Array<{
    heading: string;
    paragraphs: string[];
  }>;
  homeLabel: string;
  loginLabel: string;
};

export function LegalDocumentPage({
  eyebrow,
  title,
  summary,
  updatedAt,
  sections,
  homeLabel,
  loginLabel,
}: LegalDocumentPageProps) {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-5 py-12 md:px-8 md:py-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/" className="transition hover:text-foreground">
              {homeLabel}
            </Link>
            <span>/</span>
            <Link href="/login" className="transition hover:text-foreground">
              {loginLabel}
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">{updatedAt}</p>
        </div>

        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
            {summary}
          </p>
        </header>

        <div className="space-y-8">
          {sections.map((section) => (
            <section
              key={section.heading}
              className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground md:text-base">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

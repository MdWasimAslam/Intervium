import { type CvData } from "@/lib/cv/types";
import { type CvDesign, CV_DESIGNS } from "./designs";
import { CV_CONTENT_WIDTH_PX } from "./page-geometry";
import { cn } from "@/lib/utils";

/**
 * Pure, presentation-only CV rendering — a single-column professional resume.
 * The `design` drives genuinely different STRUCTURE: header layout (centred /
 * left / colour banner / split), section-heading style (rule / left-bar /
 * filled pill / caps / accent-underline), skills rendering (comma / chips /
 * pipes), bullet markers, and density. Every design stays ATS-friendly
 * (standard headings, real selectable text, one column) and is shared by the
 * on-screen preview and the print/PDF output, so the downloaded CV matches.
 */

/** Drop the protocol / `www.` / trailing slash so links read cleanly. */
function prettyUrl(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

/** Per-density type scale and vertical rhythm. */
const DENSITY: Record<
  CvDesign["density"],
  { root: string; section: string; expGap: string; nameSize: string }
> = {
  compact: {
    root: "text-[12px] leading-[1.4]",
    section: "mt-3.5",
    expGap: "space-y-2.5",
    nameSize: "text-[23px]",
  },
  normal: {
    root: "text-[13px] leading-[1.55]",
    section: "mt-5",
    expGap: "space-y-3.5",
    nameSize: "text-[27px]",
  },
  spacious: {
    root: "text-[13px] leading-[1.7]",
    section: "mt-7",
    expGap: "space-y-4",
    nameSize: "text-[28px]",
  },
};

export function CvDocument({
  cv,
  design = CV_DESIGNS[0],
}: {
  cv: CvData;
  design?: CvDesign;
}) {
  const { contact, summary, experience, projects, skills, education } = cv;
  const { certifications, languages } = cv;
  const d = DENSITY[design.density];

  const contactBits = [contact.email, contact.phone, contact.location]
    .map((b) => b.trim())
    .filter(Boolean);
  const headerBits = [...contactBits, ...contact.links.map(prettyUrl).filter(Boolean)];

  /* ---- Header (4 layouts) ---------------------------------------------- */
  const serif = design.font === "font-serif";
  const center = design.headerLayout === "center";
  const banner = design.headerLayout === "banner";
  const split = design.headerLayout === "split";

  const nameCls = cn(
    d.nameSize,
    "font-bold",
    center || banner ? "uppercase tracking-[0.08em]" : "tracking-tight",
    banner ? "text-white" : design.accentText,
  );
  const roleCls = cn(
    serif
      ? "text-[13.5px] italic"
      : "text-[12.5px] font-semibold uppercase tracking-[0.16em]",
    banner ? "mt-1 text-white/85" : "mt-1 text-slate-600",
  );
  const contactCls = cn("text-[11.5px]", banner ? "mt-2 text-white/85" : "mt-2 text-slate-600");

  const name = contact.name || "Your Name";
  const contactLine = headerBits.length > 0 ? headerBits.join("   |   ") : null;

  let header: React.ReactNode;
  if (banner) {
    header = (
      <header className={cn("break-inside-avoid px-5 py-4 text-center", design.accentBg)}>
        <h1 className={nameCls}>{name}</h1>
        {contact.title && <p className={roleCls}>{contact.title}</p>}
        {contactLine && <p className={contactCls}>{contactLine}</p>}
      </header>
    );
  } else if (split) {
    header = (
      <header
        className={cn(
          "flex items-end justify-between gap-4 break-inside-avoid border-b-2 pb-3",
          design.accentBorder,
        )}
      >
        <div>
          <h1 className={nameCls}>{name}</h1>
          {contact.title && <p className={roleCls}>{contact.title}</p>}
        </div>
        {contactLine && (
          <p className={cn(contactCls, "max-w-[48%] text-right leading-[1.6]")}>{contactLine}</p>
        )}
      </header>
    );
  } else {
    header = (
      <header
        className={cn(
          "break-inside-avoid border-b-2 pb-3",
          design.accentBorder,
          center ? "text-center" : "text-left",
        )}
      >
        <h1 className={nameCls}>{name}</h1>
        {contact.title && <p className={roleCls}>{contact.title}</p>}
        {contactLine && <p className={contactCls}>{contactLine}</p>}
      </header>
    );
  }

  return (
    <div
      className={cn("cv-doc mx-auto hyphens-none text-slate-700", design.font, d.root)}
      // Fixed A4 content width shared by preview AND print, so wrapping →
      // pagination is identical. See page-geometry.ts.
      style={{ width: CV_CONTENT_WIDTH_PX }}
    >
      {header}

      {summary && (
        <Section title="Summary" design={design} density={d}>
          <p>{summary}</p>
        </Section>
      )}

      {experience.some((e) => e.title || e.company) && (
        <Section title="Experience" design={design} density={d}>
          <div className={d.expGap}>
            {experience.map((exp, i) => (
              <div key={i}>
                {/* Head stays together and glued to its first bullet; the bullet
                    list itself may flow across a page so a tall entry no longer
                    gets pushed wholesale to the next page (the "random gap"). */}
                <div className="break-inside-avoid">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[13.5px] font-bold text-slate-900">
                      {exp.title || exp.company}
                    </h3>
                    {exp.period && (
                      <span className="shrink-0 text-[12px] text-slate-600">{exp.period}</span>
                    )}
                  </div>
                  {exp.company && exp.title && (
                    <p className="text-[12.5px] italic text-slate-700">{exp.company}</p>
                  )}
                  {exp.description && <p className="mt-1">{exp.description}</p>}
                </div>
                {exp.bullets.filter(Boolean).length > 0 && (
                  <Bulleted items={exp.bullets.filter(Boolean)} design={design} />
                )}
                {exp.link && (
                  <p className="mt-0.5 text-[11px] text-slate-500">{prettyUrl(exp.link)}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {projects.some((p) => p.name) && (
        <Section title="Projects" design={design} density={d}>
          <div className="space-y-2.5">
            {projects.map((proj, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[13px] font-bold text-slate-900">{proj.name}</h3>
                  {proj.url && (
                    <span className="shrink-0 text-[11px] text-slate-500">
                      {prettyUrl(proj.url)}
                    </span>
                  )}
                </div>
                {proj.description && <p>{proj.description}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Skills" design={design} density={d}>
          <Skills skills={skills} design={design} />
        </Section>
      )}

      {education.some((e) => e.degree || e.institution) && (
        <Section title="Education" design={design} density={d}>
          <div className="space-y-2">
            {education.map((edu, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[13px] font-bold text-slate-900">
                    {edu.degree || edu.institution}
                  </h3>
                  {edu.period && (
                    <span className="shrink-0 text-[12px] text-slate-600">{edu.period}</span>
                  )}
                </div>
                {edu.degree && edu.institution && (
                  <p className="text-[12.5px] italic text-slate-700">{edu.institution}</p>
                )}
                {edu.details && <p className="text-[12px] text-slate-600">{edu.details}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {certifications.some((c) => c.name) && (
        <Section title="Certifications" design={design} density={d}>
          <Bulleted
            items={certifications
              .filter((c) => c.name)
              .map((c) => (c.issuer ? `${c.name} — ${c.issuer}` : c.name))}
            design={design}
          />
        </Section>
      )}

      {languages.length > 0 && (
        <Section title="Languages" design={design} density={d}>
          <p>{languages.join("   •   ")}</p>
        </Section>
      )}
    </div>
  );
}

/* ---- Section + heading styles (5 variants) ----------------------------- */

function Section({
  title,
  design,
  density,
  children,
}: {
  title: string;
  design: CvDesign;
  density: (typeof DENSITY)[CvDesign["density"]];
  children: React.ReactNode;
}) {
  return (
    <section className={density.section}>
      <SectionHeading title={title} design={design} />
      {children}
    </section>
  );
}

function SectionHeading({ title, design }: { title: string; design: CvDesign }) {
  switch (design.headingStyle) {
    case "pill":
      return (
        <h2
          className={cn(
            "mb-2 inline-block rounded px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-white",
            design.accentBg,
          )}
        >
          {title}
        </h2>
      );
    case "bar":
      return (
        <h2
          className={cn(
            "mb-2 border-l-4 pl-2 text-[13px] font-bold uppercase tracking-[0.1em]",
            design.accentBorder,
            design.accentText,
          )}
        >
          {title}
        </h2>
      );
    case "caps":
      return (
        <h2
          className={cn(
            "mb-2 text-[12px] font-semibold uppercase tracking-[0.2em]",
            design.accentText,
          )}
        >
          {title}
        </h2>
      );
    case "accent-underline":
      return (
        <div className="mb-2">
          <h2
            className={cn(
              "text-[12px] font-bold uppercase tracking-[0.14em]",
              design.accentText,
            )}
          >
            {title}
          </h2>
          <span className={cn("mt-1 block h-[2px] w-10", design.accentBg)} aria-hidden />
        </div>
      );
    case "rule":
    default:
      return (
        <h2
          className={cn(
            "mb-2 border-b pb-1 text-[13.5px] font-bold tracking-wide",
            design.accentSoft,
            design.accentText,
          )}
        >
          {title}
        </h2>
      );
  }
}

/* ---- Skills (3 variants) ----------------------------------------------- */

function Skills({ skills, design }: { skills: string[]; design: CvDesign }) {
  if (design.skillsStyle === "chips") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s, i) => (
          <span
            key={i}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11.5px] text-slate-700"
          >
            {s}
          </span>
        ))}
      </div>
    );
  }
  if (design.skillsStyle === "pipes") {
    return <p>{skills.join("   ·   ")}</p>;
  }
  return <p>{skills.join(",  ")}</p>;
}

/* ---- Bullets (4 markers) ----------------------------------------------- */

function Bulleted({ items, design }: { items: string[]; design: CvDesign }) {
  return (
    <ul className="mt-1.5 space-y-1 text-slate-700">
      {items.map((item, j) => (
        <li key={j} className="flex gap-2 break-inside-avoid">
          <BulletMarker design={design} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function BulletMarker({ design }: { design: CvDesign }) {
  switch (design.bullet) {
    case "square":
      return <span className="mt-[5px] h-[4px] w-[4px] shrink-0 bg-slate-500" aria-hidden />;
    case "dash":
      return (
        <span className="shrink-0 select-none text-slate-400" aria-hidden>
          –
        </span>
      );
    case "chevron":
      return (
        <span className={cn("shrink-0 select-none font-semibold", design.accentText)} aria-hidden>
          ›
        </span>
      );
    case "disc":
    default:
      return (
        <span className="mt-[6px] h-[3px] w-[3px] shrink-0 rounded-full bg-slate-400" aria-hidden />
      );
  }
}

import { type CvData } from "@/lib/cv/types";

/**
 * Pure, presentation-only CV rendering — a polished, single-column layout that
 * reads as a professional resume yet stays ATS-friendly (standard section
 * headings, real selectable text, no multi-column tricks that break parsers).
 * Shared by the on-screen preview and the print/PDF output.
 */
export function CvDocument({ cv }: { cv: CvData }) {
  const { contact, summary, experience, projects, skills, education } = cv;
  const { certifications, languages } = cv;

  const contactBits = [contact.email, contact.phone, contact.location].filter(Boolean);

  return (
    <div className="cv-doc mx-auto max-w-[820px] font-sans text-[13px] leading-[1.5] text-slate-700">
      {/* Header */}
      <header className="border-b-2 border-slate-800 pb-3">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight text-slate-900">
          {contact.name || "Your Name"}
        </h1>
        {contact.title && (
          <p className="mt-0.5 text-[13px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {contact.title}
          </p>
        )}
        {(contactBits.length > 0 || contact.links.length > 0) && (
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-slate-600">
            {[...contactBits, ...contact.links].map((bit, i, arr) => (
              <span key={i} className="inline-flex items-center gap-3">
                <span>{bit}</span>
                {i < arr.length - 1 && <span className="text-slate-300">|</span>}
              </span>
            ))}
          </p>
        )}
      </header>

      {summary && (
        <Section title="Summary">
          <p className="text-slate-700">{summary}</p>
        </Section>
      )}

      {experience.some((e) => e.title || e.company) && (
        <Section title="Experience">
          <div className="space-y-3.5">
            {experience.map((exp, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[14px] font-semibold text-slate-900">
                    {exp.title || exp.company}
                  </h3>
                  {exp.period && (
                    <span className="shrink-0 text-[11.5px] font-medium text-slate-500">
                      {exp.period}
                    </span>
                  )}
                </div>
                {exp.company && exp.title && (
                  <p className="text-[12.5px] font-medium text-slate-600">{exp.company}</p>
                )}
                {exp.description && <p className="mt-1 text-slate-700">{exp.description}</p>}
                {exp.bullets.filter(Boolean).length > 0 && (
                  <ul className="mt-1.5 space-y-1 text-slate-700">
                    {exp.bullets.filter(Boolean).map((b, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="mt-[6px] h-[3px] w-[3px] shrink-0 rounded-full bg-slate-400" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {exp.link && (
                  <p className="mt-0.5 text-[11px] text-slate-400">{exp.link}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {projects.some((p) => p.name) && (
        <Section title="Projects">
          <div className="space-y-2.5">
            {projects.map((proj, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[13.5px] font-semibold text-slate-900">{proj.name}</h3>
                  {proj.url && (
                    <span className="shrink-0 text-[11px] text-slate-400">{proj.url}</span>
                  )}
                </div>
                {proj.description && <p className="text-slate-700">{proj.description}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Skills">
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
        </Section>
      )}

      {education.some((e) => e.degree || e.institution) && (
        <Section title="Education">
          <div className="space-y-2">
            {education.map((edu, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[13.5px] font-semibold text-slate-900">
                    {edu.degree || edu.institution}
                  </h3>
                  {edu.period && (
                    <span className="shrink-0 text-[11.5px] font-medium text-slate-500">
                      {edu.period}
                    </span>
                  )}
                </div>
                {edu.degree && edu.institution && (
                  <p className="text-[12.5px] text-slate-600">{edu.institution}</p>
                )}
                {edu.details && <p className="text-[11.5px] text-slate-500">{edu.details}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {certifications.some((c) => c.name) && (
        <Section title="Certifications">
          <ul className="space-y-1 text-slate-700">
            {certifications.map((cert, i) => (
              <li key={i} className="flex gap-2 break-inside-avoid">
                <span className="mt-[6px] h-[3px] w-[3px] shrink-0 rounded-full bg-slate-400" />
                <span>
                  <span className="font-medium text-slate-900">{cert.name}</span>
                  {cert.issuer && <span className="text-slate-600"> — {cert.issuer}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {languages.length > 0 && (
        <Section title="Languages">
          <p className="text-slate-700">{languages.join("  •  ")}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.16em] text-slate-900">
        {title}
        <span className="mt-1 block h-px w-full bg-slate-200" />
      </h2>
      {children}
    </section>
  );
}

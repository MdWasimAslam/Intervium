import { type CvData } from "@/lib/cv/types";

/**
 * Pure, presentation-only CV rendering in a clean, single-column,
 * ATS-friendly layout (standard section headings, real text, no multi-column
 * tricks that confuse parsers). Used both for the on-screen preview and the
 * print/PDF output, so the downloaded file matches what's shown.
 */
export function CvDocument({ cv }: { cv: CvData }) {
  const { contact, summary, experience, projects, skills, education } = cv;
  const { certifications, languages } = cv;

  const contactBits = [contact.email, contact.phone, contact.location].filter(Boolean);

  return (
    <div className="cv-doc mx-auto max-w-[800px] font-sans text-[13px] leading-relaxed text-gray-900">
      {/* Header */}
      <header className="text-center">
        <h1 className="text-[26px] font-bold uppercase tracking-[0.06em] text-gray-900">
          {contact.name || "Your Name"}
        </h1>
        {contact.title && (
          <p className="mt-0.5 text-[13px] font-medium uppercase tracking-[0.18em] text-gray-600">
            {contact.title}
          </p>
        )}
        {(contactBits.length > 0 || contact.links.length > 0) && (
          <p className="mt-2 text-[12px] text-gray-700">
            {[...contactBits, ...contact.links].join("  •  ")}
          </p>
        )}
      </header>

      {summary && (
        <Section title="Summary">
          <p>{summary}</p>
        </Section>
      )}

      {experience.some((e) => e.title || e.company) && (
        <Section title="Experience">
          <div className="space-y-3.5">
            {experience.map((exp, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-bold text-gray-900">{exp.title || exp.company}</h3>
                  {exp.period && (
                    <span className="shrink-0 text-[12px] text-gray-600">{exp.period}</span>
                  )}
                </div>
                {(exp.company && exp.title) && (
                  <p className="text-[12.5px] font-medium italic text-gray-700">{exp.company}</p>
                )}
                {exp.description && <p className="mt-1 text-gray-800">{exp.description}</p>}
                {exp.bullets.filter(Boolean).length > 0 && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-gray-800">
                    {exp.bullets.filter(Boolean).map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                )}
                {exp.link && <p className="mt-0.5 text-[11.5px] text-gray-500">{exp.link}</p>}
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
                  <h3 className="font-bold text-gray-900">{proj.name}</h3>
                  {proj.url && <span className="shrink-0 text-[11.5px] text-gray-500">{proj.url}</span>}
                </div>
                {proj.description && <p className="text-gray-800">{proj.description}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Skills">
          <p className="text-gray-800">{skills.join("  •  ")}</p>
        </Section>
      )}

      {education.some((e) => e.degree || e.institution) && (
        <Section title="Education">
          <div className="space-y-2">
            {education.map((edu, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-bold text-gray-900">{edu.degree || edu.institution}</h3>
                  {edu.period && (
                    <span className="shrink-0 text-[12px] text-gray-600">{edu.period}</span>
                  )}
                </div>
                {edu.degree && edu.institution && (
                  <p className="text-[12.5px] italic text-gray-700">{edu.institution}</p>
                )}
                {edu.details && <p className="text-[12px] text-gray-600">{edu.details}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {certifications.some((c) => c.name) && (
        <Section title="Certifications">
          <ul className="list-disc space-y-1 pl-5 text-gray-800">
            {certifications.map((cert, i) => (
              <li key={i} className="break-inside-avoid">
                <span className="font-medium">{cert.name}</span>
                {cert.issuer && <span className="text-gray-700"> — {cert.issuer}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {languages.length > 0 && (
        <Section title="Languages">
          <p className="text-gray-800">{languages.join("  •  ")}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="mb-1.5 border-b border-gray-400 pb-0.5 text-[12px] font-bold uppercase tracking-[0.12em] text-gray-800">
        {title}
      </h2>
      {children}
    </section>
  );
}

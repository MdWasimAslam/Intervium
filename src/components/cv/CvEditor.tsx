"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  type CvCertification,
  type CvData,
  type CvEducation,
  type CvExperience,
  type CvProject,
} from "@/lib/cv/types";

/**
 * Editable CV sections (contact, summary, experience, skills, education).
 * Fully controlled — every change flows up via `onChange`.
 */
export function CvEditor({
  cv,
  onChange,
}: {
  cv: CvData;
  onChange: (cv: CvData) => void;
}) {
  const patch = (partial: Partial<CvData>) => onChange({ ...cv, ...partial });

  return (
    <div className="space-y-5">
      {/* Contact */}
      <Section title="Contact">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={cv.contact.name}
              onChange={(e) => patch({ contact: { ...cv.contact, name: e.target.value } })}
            />
          </Field>
          <Field label="Title">
            <Input
              value={cv.contact.title}
              onChange={(e) => patch({ contact: { ...cv.contact, title: e.target.value } })}
              placeholder="Software Developer"
            />
          </Field>
          <Field label="Email">
            <Input
              value={cv.contact.email}
              onChange={(e) => patch({ contact: { ...cv.contact, email: e.target.value } })}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={cv.contact.phone}
              onChange={(e) => patch({ contact: { ...cv.contact, phone: e.target.value } })}
            />
          </Field>
          <Field label="Location">
            <Input
              value={cv.contact.location}
              onChange={(e) => patch({ contact: { ...cv.contact, location: e.target.value } })}
            />
          </Field>
        </div>
        <Field label="Links (comma-separated)">
          <Input
            value={cv.contact.links.join(", ")}
            onChange={(e) =>
              patch({
                contact: {
                  ...cv.contact,
                  links: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                },
              })
            }
            placeholder="linkedin.com/in/you, github.com/you"
          />
        </Field>
      </Section>

      {/* Summary */}
      <Section title="Summary">
        <Textarea
          rows={4}
          value={cv.summary}
          onChange={(e) => patch({ summary: e.target.value })}
          placeholder="A concise professional summary…"
        />
      </Section>

      {/* Experience */}
      <Section
        title="Experience"
        action={
          <AddButton
            onClick={() =>
              patch({
                experience: [
                  ...cv.experience,
                  { title: "", company: "", period: "", link: "", description: "", bullets: [] },
                ],
              })
            }
          />
        }
      >
        {cv.experience.length === 0 && <Empty>No experience yet — add one.</Empty>}
        <div className="space-y-4">
          {cv.experience.map((exp, i) => (
            <ExperienceRow
              key={i}
              exp={exp}
              onChange={(next) => {
                const list = [...cv.experience];
                list[i] = next;
                patch({ experience: list });
              }}
              onRemove={() => patch({ experience: cv.experience.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
      </Section>

      {/* Projects */}
      <Section
        title="Projects"
        action={
          <AddButton
            onClick={() =>
              patch({ projects: [...cv.projects, { name: "", url: "", description: "" }] })
            }
          />
        }
      >
        {cv.projects.length === 0 && <Empty>No projects yet — add one.</Empty>}
        <div className="space-y-4">
          {cv.projects.map((project, i) => (
            <ProjectRow
              key={i}
              project={project}
              onChange={(next) => {
                const list = [...cv.projects];
                list[i] = next;
                patch({ projects: list });
              }}
              onRemove={() => patch({ projects: cv.projects.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
      </Section>

      {/* Skills */}
      <Section title="Skills">
        <SkillsEditor
          skills={cv.skills}
          onChange={(skills) => patch({ skills })}
        />
      </Section>

      {/* Education */}
      <Section
        title="Education"
        action={
          <AddButton
            onClick={() =>
              patch({
                education: [
                  ...cv.education,
                  { degree: "", institution: "", period: "", details: "" },
                ],
              })
            }
          />
        }
      >
        {cv.education.length === 0 && <Empty>No education yet — add one.</Empty>}
        <div className="space-y-4">
          {cv.education.map((edu, i) => (
            <EducationRow
              key={i}
              edu={edu}
              onChange={(next) => {
                const list = [...cv.education];
                list[i] = next;
                patch({ education: list });
              }}
              onRemove={() => patch({ education: cv.education.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
      </Section>

      {/* Certifications */}
      <Section
        title="Certifications"
        action={
          <AddButton
            onClick={() =>
              patch({
                certifications: [...cv.certifications, { name: "", issuer: "", url: "" }],
              })
            }
          />
        }
      >
        {cv.certifications.length === 0 && <Empty>No certifications yet — add one.</Empty>}
        <div className="space-y-4">
          {cv.certifications.map((cert, i) => (
            <CertificationRow
              key={i}
              cert={cert}
              onChange={(next) => {
                const list = [...cv.certifications];
                list[i] = next;
                patch({ certifications: list });
              }}
              onRemove={() =>
                patch({ certifications: cv.certifications.filter((_, j) => j !== i) })
              }
            />
          ))}
        </div>
      </Section>

      {/* Languages */}
      <Section title="Languages">
        <SkillsEditor
          skills={cv.languages}
          onChange={(languages) => patch({ languages })}
          placeholder="Add a language and press Enter"
        />
      </Section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-editors                                                                */
/* -------------------------------------------------------------------------- */

function ExperienceRow({
  exp,
  onChange,
  onRemove,
}: {
  exp: CvExperience;
  onChange: (e: CvExperience) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-start gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <Input
            value={exp.title}
            onChange={(e) => onChange({ ...exp, title: e.target.value })}
            placeholder="Title"
          />
          <Input
            value={exp.company}
            onChange={(e) => onChange({ ...exp, company: e.target.value })}
            placeholder="Company"
          />
          <Input
            value={exp.period}
            onChange={(e) => onChange({ ...exp, period: e.target.value })}
            placeholder="2022 – Present"
          />
        </div>
        <RemoveButton onClick={onRemove} />
      </div>
      <Field label="Description">
        <Textarea
          rows={3}
          value={exp.description}
          onChange={(e) => onChange({ ...exp, description: e.target.value })}
          placeholder="A short overview of the role / project…"
        />
      </Field>
      <Field label="Bullets (one per line)">
        <Textarea
          rows={3}
          value={exp.bullets.join("\n")}
          onChange={(e) =>
            onChange({ ...exp, bullets: e.target.value.split("\n").map((b) => b.replace(/^[•\-\s]+/, "")) })
          }
          placeholder="Led a team that…"
        />
      </Field>
      <Field label="Link (optional)">
        <Input
          value={exp.link}
          onChange={(e) => onChange({ ...exp, link: e.target.value })}
          placeholder="https://…"
        />
      </Field>
    </div>
  );
}

function ProjectRow({
  project,
  onChange,
  onRemove,
}: {
  project: CvProject;
  onChange: (p: CvProject) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-start gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <Input
            value={project.name}
            onChange={(e) => onChange({ ...project, name: e.target.value })}
            placeholder="Project name"
          />
          <Input
            value={project.url}
            onChange={(e) => onChange({ ...project, url: e.target.value })}
            placeholder="https://…"
          />
        </div>
        <RemoveButton onClick={onRemove} />
      </div>
      <Textarea
        rows={2}
        value={project.description}
        onChange={(e) => onChange({ ...project, description: e.target.value })}
        placeholder="What it does…"
      />
    </div>
  );
}

function CertificationRow({
  cert,
  onChange,
  onRemove,
}: {
  cert: CvCertification;
  onChange: (c: CvCertification) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-4">
      <div className="grid flex-1 gap-3 sm:grid-cols-3">
        <Input
          value={cert.name}
          onChange={(e) => onChange({ ...cert, name: e.target.value })}
          placeholder="Certificate"
        />
        <Input
          value={cert.issuer}
          onChange={(e) => onChange({ ...cert, issuer: e.target.value })}
          placeholder="Issuer"
        />
        <Input
          value={cert.url}
          onChange={(e) => onChange({ ...cert, url: e.target.value })}
          placeholder="https://…"
        />
      </div>
      <RemoveButton onClick={onRemove} />
    </div>
  );
}

function EducationRow({
  edu,
  onChange,
  onRemove,
}: {
  edu: CvEducation;
  onChange: (e: CvEducation) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-start gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <Input
            value={edu.degree}
            onChange={(e) => onChange({ ...edu, degree: e.target.value })}
            placeholder="Degree"
          />
          <Input
            value={edu.institution}
            onChange={(e) => onChange({ ...edu, institution: e.target.value })}
            placeholder="Institution"
          />
          <Input
            value={edu.period}
            onChange={(e) => onChange({ ...edu, period: e.target.value })}
            placeholder="2016 – 2020"
          />
        </div>
        <RemoveButton onClick={onRemove} />
      </div>
      <Input
        value={edu.details}
        onChange={(e) => onChange({ ...edu, details: e.target.value })}
        placeholder="Details (optional)"
      />
    </div>
  );
}

function SkillsEditor({
  skills,
  onChange,
  placeholder = "Add a skill and press Enter",
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (value && !skills.includes(value)) onChange([...skills, value]);
    setDraft("");
  };

  return (
    <div className="space-y-3">
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skills.map((s, i) => (
            <Chip key={`${s}-${i}`} className="pr-1.5">
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => onChange(skills.filter((_, j) => j !== i))}
                className="ml-0.5 rounded-full p-0.5 hover:bg-[var(--muted)]"
              >
                <X className="h-3 w-3" />
              </button>
            </Chip>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small layout helpers                                                       */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      <Plus className="h-4 w-4" /> Add
    </Button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={onClick}>
      <Trash2 className="h-4 w-4 text-[var(--muted-foreground)]" />
    </Button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--muted-foreground)]">{children}</p>;
}

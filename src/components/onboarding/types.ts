/** Serializable reference data passed from the server to the wizard. */
export interface RoleOption {
  id: string;
  name: string;
  description: string | null;
}

export interface StackOption {
  id: string;
  jobRoleId: string;
  name: string;
}

export interface BandOption {
  jobRoleId: string;
  label: string;
  minYears: number | null;
  maxYears: number | null;
}

/** Wizard form state. */
export interface WizardValues {
  displayName: string;
  primaryRoleId: string;
  yearsExperience: number;
  skills: string[];
  targetRole: string;
  cvText: string;
}

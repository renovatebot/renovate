export type PantsTargetType =
  | 'python_requirement'
  | 'python_requirements'
  | 'poetry_requirements';

export interface PantsToken {
  value: string;
  line: number;
}

export interface PantsTarget {
  type: PantsTargetType;
  /** The target's `name=`, when given. */
  name?: string;
  /** `python_requirement(requirements=[...])` entries, as PEP 508 strings. */
  requirements: PantsToken[];
  /** `python_requirements(source=...)`, relative to the BUILD file. */
  source?: PantsToken;
}

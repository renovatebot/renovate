export type PantsTargetType =
  | 'python_requirement'
  | 'python_requirements'
  | 'poetry_requirements'
  | 'uv_requirements';

/**
 * One entry of a `requirements` field. Python joins adjacent string literals,
 * so a requirement can be written in several parts, and only text the file
 * holds in one piece can be replaced in it.
 */
export interface PantsRequirement {
  value: string;
  parts: string[];
}

export interface PantsTarget {
  type: PantsTargetType;
  /** The target's `name=`, when given. */
  name?: string;
  /** `python_requirement(requirements=[...])` entries, as PEP 508 strings. */
  requirements: PantsRequirement[];
  /** A generator's `source=...`, relative to the build file. */
  source?: string;
  /**
   * `source=` was given as something other than a string, such as a variable,
   * so the file it names is unknown. Distinct from the field being absent,
   * where the default applies.
   */
  sourceUnresolved?: boolean;
}

/** The target types that generate requirements from a source file. */
export type PantsGeneratorType = Exclude<PantsTargetType, 'python_requirement'>;

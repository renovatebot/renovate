export interface KrakenLockFile {
  requirements?: KrakenRequirements;
  pinned?: KrakenDependencies;
}

export interface KrakenRequirements {
  requirements?: string[];
  index_url?: string;
  interpreter_constraint?: string;
}

export type KrakenDependencies = Record<string, string>;

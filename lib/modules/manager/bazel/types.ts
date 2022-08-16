export interface UrlParsedResult {
  datasource: string;
  repo: string;
  currentValue: string;
}

export interface BazelManagerData {
  def: string;
}

export type TargetAttribute = string | string[];

export interface Target extends Record<string, TargetAttribute> {
  rule: string;
  name: string;
}

export type PathElement = string | number;
export type MetaPath = PathElement[];

export interface MetaData {
  offset: number;
  length: number;
}

export interface RuleMeta {
  path: MetaPath;
  data: MetaData;
}

export interface ParsedResult {
  targets: Target[];
  meta: RuleMeta[];
}

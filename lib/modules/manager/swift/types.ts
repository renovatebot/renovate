export interface MatchResult {
  idx: number;
  len: number;
  label: string;
  substr: string;
}

export interface ParsedRegistries {
  defaultUrl?: string;
  named: Record<string, string>;
}

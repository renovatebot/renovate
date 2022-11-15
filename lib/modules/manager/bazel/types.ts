export interface UrlParsedResult {
  datasource: string;
  repo: string;
  currentValue: string;
}

export interface BazelManagerData {
  idx: number;
}

export type TargetAttribute = string | string[];

export interface Target extends Record<string, TargetAttribute> {
  rule: string;
  name: string;
}

interface FragmentBase {
  value: string;
  offset: number;
}

export interface ArrayFragment extends FragmentBase {
  type: 'array';
  children: Fragment[];
}

export interface RecordFragment extends FragmentBase {
  type: 'record';
  children: Record<string, Fragment>;
}

export interface StringFragment extends FragmentBase {
  type: 'string';
}

export type NestedFragment = ArrayFragment | RecordFragment;
export type Fragment = NestedFragment | StringFragment;

export type FragmentData =
  | string
  | FragmentData[]
  | { [k: string]: FragmentData };

export type FragmentPath =
  | [number]
  | [number, string]
  | [number, string, number];

export type FragmentUpdater = string | ((_: string) => string);

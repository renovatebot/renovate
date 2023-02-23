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

/**
 * Parsed bazel files are represented as nested arrays and objects,
 * which is enough for Renovate purposes.
 */
export type FragmentData =
  | string
  | FragmentData[]
  | { [k: string]: FragmentData };

/**
 * To access a fragment, we provide its path in the tree.
 *
 * The first element is the index of the rule in the file,
 * which had been chosen over the rule name because it helps
 * to deal with duplicate rule names in `if-else` branches.
 */
export type FragmentPath =
  | [number]
  | [number, string]
  | [number, string, number]
  | [number, string, number, string];

export type FragmentUpdater = string | ((_: string) => string);

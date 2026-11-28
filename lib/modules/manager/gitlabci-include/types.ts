import type { Scalar } from 'yaml';
import type { PackageDependency } from '../types.ts';

export interface CommentRefMatch {
  ref: string;
  matchedString: string;
}

export interface RefDigestOptions {
  content: string;
  keyStart: number;
  valueNode: Scalar;
  valueRange: [number, number, number];
  ref: string;
  valuePrefix?: string;
  isFlow: boolean;
}

export type RefDigestProps = Pick<
  PackageDependency,
  | 'currentValue'
  | 'currentDigest'
  | 'replaceString'
  | 'autoReplaceStringTemplate'
  | 'pinDigests'
  | 'skipReason'
>;

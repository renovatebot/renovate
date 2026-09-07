import type { z } from 'zod/v4';
import type * as fragments from './fragments.ts';

export type AllFragments = z.infer<typeof fragments.AllFragments>;
export type ArrayFragment = z.infer<typeof fragments.ArrayFragment>;
export type AttributeFragment = z.infer<typeof fragments.AttributeFragment>;
export type BooleanFragment = z.infer<typeof fragments.BooleanFragment>;
export type ChildFragments = Record<string, ValueFragments>;
export type PrimitiveFragments = z.infer<typeof fragments.PrimitiveFragments>;
export type RuleFragment = z.infer<typeof fragments.RuleFragment>;
export type PreparedExtensionTagFragment = z.infer<
  typeof fragments.PreparedExtensionTagFragment
>;
export type ExtensionTagFragment = z.infer<
  typeof fragments.ExtensionTagFragment
>;
export type UseRepoRuleFragment = z.infer<typeof fragments.UseRepoRuleFragment>;
export type RepoRuleCallFragment = z.infer<
  typeof fragments.RepoRuleCallFragment
>;
export type StringFragment = z.infer<typeof fragments.StringFragment>;
export type ValueFragments = z.infer<typeof fragments.ValueFragments>;
export type ResultFragment =
  | RuleFragment
  | ExtensionTagFragment
  | UseRepoRuleFragment
  | RepoRuleCallFragment;

// Represents the fields that the context must have.
export interface CtxCompatible {
  results: ResultFragment[];
  stack: AllFragments[];
}

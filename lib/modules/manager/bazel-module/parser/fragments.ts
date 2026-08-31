import { isString } from '@sindresorhus/is';
import { z } from 'zod/v4';
import {
  LooseArray,
  LooseRecord,
} from '../../../../util/schema-utils/index.ts';
import * as starlark from './starlark.ts';
import type { ChildFragments } from './types.ts';

export const StringFragment = z.object({
  type: z.literal('string'),
  value: z.string(),
  isComplete: z.literal(true),
});
export const BooleanFragment = z.object({
  type: z.literal('boolean'),
  value: z.boolean(),
  isComplete: z.literal(true),
});
export const PrimitiveFragments = z.discriminatedUnion('type', [
  StringFragment,
  BooleanFragment,
]);
export const ArrayFragment = z.object({
  type: z.literal('array'),
  items: LooseArray(PrimitiveFragments),
  isComplete: z.boolean(),
});
export const StringArrayFragment = z.object({
  type: z.literal('array'),
  items: LooseArray(StringFragment),
  isComplete: z.boolean(),
});
export const ValueFragments = z.discriminatedUnion('type', [
  StringFragment,
  BooleanFragment,
  ArrayFragment,
]);
export const RuleFragment = z.object({
  type: z.literal('rule'),
  rule: z.string(),
  children: LooseRecord(ValueFragments),
  isComplete: z.boolean(),
});
export const PreparedExtensionTagFragment = z.object({
  type: z.literal('preparedExtensionTag'),
  // See ExtensionTagFragment for documentation of the fields.
  extension: z.string(),
  rawExtension: z.string(),
  offset: z.number(), // start offset in the source string
  isComplete: z.literal(false), // never complete, parser internal type.
});
export const ExtensionTagFragment = z.object({
  type: z.literal('extensionTag'),
  // The "logical" name of the extension (e.g. `oci` or `maven`).
  extension: z.string(),
  // The "raw" name of the extension as it appears in the MODULE file (e.g. `maven_01` or `maven`)
  rawExtension: z.string(),
  tag: z.string(),
  children: LooseRecord(ValueFragments),
  isComplete: z.boolean(),
  offset: z.number(), // start offset in the source string
  rawString: z.string().optional(), // raw source string
});
export const UseRepoRuleFragment = z.object({
  type: z.literal('useRepoRule'),
  variableName: z.string(),
  bzlFile: z.string(),
  ruleName: z.string(),
  isComplete: z.boolean(),
});
export const RepoRuleCallFragment = z.object({
  type: z.literal('repoRuleCall'),
  functionName: z.string(),
  children: LooseRecord(ValueFragments),
  isComplete: z.boolean(),
  offset: z.number(),
  rawString: z.string().optional(),
});
export const AttributeFragment = z.object({
  type: z.literal('attribute'),
  name: z.string(),
  value: ValueFragments.optional(),
  isComplete: z.boolean(),
});
export const AllFragments = z.discriminatedUnion('type', [
  ArrayFragment,
  AttributeFragment,
  BooleanFragment,
  RuleFragment,
  PreparedExtensionTagFragment,
  ExtensionTagFragment,
  UseRepoRuleFragment,
  RepoRuleCallFragment,
  StringFragment,
]);

export function string(value: string): z.infer<typeof StringFragment> {
  return {
    type: 'string',
    isComplete: true,
    value,
  };
}

export function boolean(
  value: string | boolean,
): z.infer<typeof BooleanFragment> {
  return {
    type: 'boolean',
    isComplete: true,
    value: isString(value) ? starlark.asBoolean(value) : value,
  };
}

export function rule(
  rule: string,
  children: ChildFragments = {},
  isComplete = false,
): z.infer<typeof RuleFragment> {
  return {
    type: 'rule',
    rule,
    isComplete,
    children,
  };
}

export function preparedExtensionTag(
  extension: string,
  rawExtension: string,
  offset: number,
): z.infer<typeof PreparedExtensionTagFragment> {
  return {
    type: 'preparedExtensionTag',
    extension,
    rawExtension,
    offset,
    isComplete: false, // never complete
  };
}

export function extensionTag(
  extension: string,
  rawExtension: string,
  tag: string,
  offset: number,
  children: ChildFragments = {},
  rawString?: string,
  isComplete = false,
): z.infer<typeof ExtensionTagFragment> {
  return {
    type: 'extensionTag',
    extension,
    rawExtension,
    tag,
    offset,
    rawString,
    isComplete,
    children,
  };
}

export function useRepoRule(
  variableName: string,
  bzlFile: string,
  ruleName: string,
  isComplete = false,
): z.infer<typeof UseRepoRuleFragment> {
  return {
    type: 'useRepoRule',
    variableName,
    bzlFile,
    ruleName,
    isComplete,
  };
}

export function repoRuleCall(
  functionName: string,
  offset: number,
  children: ChildFragments = {},
  rawString?: string,
  isComplete = false,
): z.infer<typeof RepoRuleCallFragment> {
  return {
    type: 'repoRuleCall',
    functionName,
    offset,
    rawString,
    isComplete,
    children,
  };
}

export function attribute(
  name: string,
  value?: z.infer<typeof ValueFragments>,
  isComplete = false,
): z.infer<typeof AttributeFragment> {
  return {
    type: 'attribute',
    name,
    value,
    isComplete,
  };
}

export function array(
  items: z.infer<typeof PrimitiveFragments>[] = [],
  isComplete = false,
): z.infer<typeof ArrayFragment> {
  return {
    type: 'array',
    items,
    isComplete,
  };
}

export function isValue(data: unknown): data is z.infer<typeof ValueFragments> {
  const result = ValueFragments.safeParse(data);
  return result.success;
}

export function isPrimitive(
  data: unknown,
): data is z.infer<typeof PrimitiveFragments> {
  const result = PrimitiveFragments.safeParse(data);
  return result.success;
}

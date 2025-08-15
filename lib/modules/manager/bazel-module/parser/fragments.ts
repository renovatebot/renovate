import { z } from 'zod';
import { LooseArray, LooseRecord } from '../../../../util/schema-utils';
import * as starlark from './starlark';

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
const PrimitiveFragments = z.discriminatedUnion('type', [
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
const ValueFragments = z.discriminatedUnion('type', [
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
  StringFragment,
]);

export type AllFragments = z.infer<typeof AllFragments>;
export type ArrayFragment = z.infer<typeof ArrayFragment>;
export type AttributeFragment = z.infer<typeof AttributeFragment>;
export type BooleanFragment = z.infer<typeof BooleanFragment>;
export type ChildFragments = Record<string, ValueFragments>;
export type PrimitiveFragments = z.infer<typeof PrimitiveFragments>;
export type RuleFragment = z.infer<typeof RuleFragment>;
export type PreparedExtensionTagFragment = z.infer<
  typeof PreparedExtensionTagFragment
>;
export type ExtensionTagFragment = z.infer<typeof ExtensionTagFragment>;
export type StringFragment = z.infer<typeof StringFragment>;
export type ValueFragments = z.infer<typeof ValueFragments>;
export type ResultFragment = RuleFragment | ExtensionTagFragment;

export function string(value: string): StringFragment {
  return {
    type: 'string',
    isComplete: true,
    value,
  };
}

export function boolean(value: string | boolean): BooleanFragment {
  return {
    type: 'boolean',
    isComplete: true,
    value: typeof value === 'string' ? starlark.asBoolean(value) : value,
  };
}

export function rule(
  rule: string,
  children: ChildFragments = {},
  isComplete = false,
): RuleFragment {
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
): PreparedExtensionTagFragment {
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
): ExtensionTagFragment {
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

export function attribute(
  name: string,
  value?: ValueFragments,
  isComplete = false,
): AttributeFragment {
  return {
    type: 'attribute',
    name,
    value,
    isComplete,
  };
}

export function array(
  items: PrimitiveFragments[] = [],
  isComplete = false,
): ArrayFragment {
  return {
    type: 'array',
    items,
    isComplete,
  };
}

export function isValue(data: unknown): data is ValueFragments {
  const result = ValueFragments.safeParse(data);
  return result.success;
}

export function isPrimitive(data: unknown): data is PrimitiveFragments {
  const result = PrimitiveFragments.safeParse(data);
  return result.success;
}

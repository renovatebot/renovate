import { z } from 'zod';
import { LooseArray, LooseRecord } from '../../../../util/schema-utils';
import * as starlark from './starlark';

export const StringFragmentSchema = z.object({
  type: z.literal('string'),
  value: z.string(),
  isComplete: z.literal(true),
});
export const BooleanFragmentSchema = z.object({
  type: z.literal('boolean'),
  value: z.boolean(),
  isComplete: z.literal(true),
});
const PrimitiveFragmentsSchema = z.discriminatedUnion('type', [
  StringFragmentSchema,
  BooleanFragmentSchema,
]);
export const ArrayFragmentSchema = z.object({
  type: z.literal('array'),
  items: LooseArray(PrimitiveFragmentsSchema),
  isComplete: z.boolean(),
});
export const StringArrayFragmentSchema = z.object({
  type: z.literal('array'),
  items: LooseArray(StringFragmentSchema),
  isComplete: z.boolean(),
});
const ValueFragmentsSchema = z.discriminatedUnion('type', [
  StringFragmentSchema,
  BooleanFragmentSchema,
  ArrayFragmentSchema,
]);
export const RuleFragmentSchema = z.object({
  type: z.literal('rule'),
  rule: z.string(),
  children: LooseRecord(ValueFragmentsSchema),
  isComplete: z.boolean(),
});
export const PreparedExtensionTagFragmentSchema = z.object({
  type: z.literal('preparedExtensionTag'),
  // See ExtensionTagFragmentSchema for documentation of the fields.
  extension: z.string(),
  rawExtension: z.string(),
  offset: z.number(), // start offset in the source string
  isComplete: z.literal(false), // never complete, parser internal type.
});
export const ExtensionTagFragmentSchema = z.object({
  type: z.literal('extensionTag'),
  // The "logical" name of the extension (e.g. `oci` or `maven`).
  extension: z.string(),
  // The "raw" name of the extension as it appears in the MODULE file (e.g. `maven_01` or `maven`)
  rawExtension: z.string(),
  tag: z.string(),
  children: LooseRecord(ValueFragmentsSchema),
  isComplete: z.boolean(),
  offset: z.number(), // start offset in the source string
  rawString: z.string().optional(), // raw source string
});
export const AttributeFragmentSchema = z.object({
  type: z.literal('attribute'),
  name: z.string(),
  value: ValueFragmentsSchema.optional(),
  isComplete: z.boolean(),
});
export const AllFragmentsSchema = z.discriminatedUnion('type', [
  ArrayFragmentSchema,
  AttributeFragmentSchema,
  BooleanFragmentSchema,
  RuleFragmentSchema,
  PreparedExtensionTagFragmentSchema,
  ExtensionTagFragmentSchema,
  StringFragmentSchema,
]);

export type AllFragments = z.infer<typeof AllFragmentsSchema>;
export type ArrayFragment = z.infer<typeof ArrayFragmentSchema>;
export type AttributeFragment = z.infer<typeof AttributeFragmentSchema>;
export type BooleanFragment = z.infer<typeof BooleanFragmentSchema>;
export type ChildFragments = Record<string, ValueFragments>;
export type PrimitiveFragments = z.infer<typeof PrimitiveFragmentsSchema>;
export type RuleFragment = z.infer<typeof RuleFragmentSchema>;
export type PreparedExtensionTagFragment = z.infer<
  typeof PreparedExtensionTagFragmentSchema
>;
export type ExtensionTagFragment = z.infer<typeof ExtensionTagFragmentSchema>;
export type StringFragment = z.infer<typeof StringFragmentSchema>;
export type ValueFragments = z.infer<typeof ValueFragmentsSchema>;
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
  const result = ValueFragmentsSchema.safeParse(data);
  return result.success;
}

export function isPrimitive(data: unknown): data is PrimitiveFragments {
  const result = PrimitiveFragmentsSchema.safeParse(data);
  return result.success;
}

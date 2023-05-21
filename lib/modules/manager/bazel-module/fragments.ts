import { z } from 'zod';
import { LooseArray, LooseRecord } from '../../../util/schema-utils';

export const StringFragmentSchema = z.object({
  type: z.literal('string'),
  value: z.string(),
  isComplete: z.literal(true),
});
export const ArrayFragmentSchema = z.object({
  type: z.literal('array'),
  items: LooseArray(StringFragmentSchema),
  isComplete: z.boolean(),
});
const ValueFragmentsSchema = z.discriminatedUnion('type', [
  ArrayFragmentSchema,
  StringFragmentSchema,
]);
export const RecordFragmentSchema = z.object({
  type: z.literal('record'),
  children: LooseRecord(ValueFragmentsSchema),
  isComplete: z.boolean(),
});
export const AttributeFragmentSchema = z.object({
  type: z.literal('attribute'),
  name: z.string(),
  value: ValueFragmentsSchema.optional(),
  isComplete: z.boolean(),
});
const AllFragmentsSchema = z.discriminatedUnion('type', [
  ArrayFragmentSchema,
  AttributeFragmentSchema,
  RecordFragmentSchema,
  StringFragmentSchema,
]);

export type AllFragments = z.infer<typeof AllFragmentsSchema>;
export type ArrayFragment = z.infer<typeof ArrayFragmentSchema>;
export type AttributeFragment = z.infer<typeof AttributeFragmentSchema>;
export type ChildFragments = Record<string, ValueFragments>;
export type RecordFragment = z.infer<typeof RecordFragmentSchema>;
export type StringFragment = z.infer<typeof StringFragmentSchema>;
export type ValueFragments = z.infer<typeof ValueFragmentsSchema>;

export function string(value: string): StringFragment {
  return {
    type: 'string',
    isComplete: true,
    value,
  };
}

export function record(
  children: ChildFragments = {},
  isComplete = false
): RecordFragment {
  return {
    type: 'record',
    isComplete,
    children,
  };
}

export function attribute(
  name: string,
  value?: ValueFragments,
  isComplete = false
): AttributeFragment {
  return {
    type: 'attribute',
    name,
    value,
    isComplete,
  };
}

export function array(
  items: StringFragment[] = [],
  isComplete = false
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

export function isString(data: unknown): data is StringFragment {
  const result = StringFragmentSchema.safeParse(data);
  return result.success;
}

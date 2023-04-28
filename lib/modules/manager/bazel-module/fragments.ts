import is from '@sindresorhus/is';
import { z } from 'zod';
import { StarlarkBoolean } from './starlark';

// Fragment Schemas

const FragmentTypeSchema = z.enum([
  'string',
  'boolean',
  'array',
  'record',
  'attribute',
]);
const CommonFragmentSchema = z.object({
  type: FragmentTypeSchema,
});
const CompletableSchema = z.object({
  isComplete: z.boolean(),
});
const ChildFragmentsSchema = z.record(z.string(), CommonFragmentSchema);
const StringFragmentSchema = CommonFragmentSchema.merge(
  CompletableSchema
).extend({
  type: z.enum(['string']),
  value: z.string(),
});
const BooleanFragmentSchema = CommonFragmentSchema.merge(
  CompletableSchema
).extend({
  type: z.enum(['boolean']),
  value: z.boolean(),
});
const ArrayFragmentSchema = CommonFragmentSchema.merge(
  CompletableSchema
).extend({
  type: z.enum(['array']),
  items: z.array(CommonFragmentSchema),
});
const RecordFragmentSchema = CommonFragmentSchema.merge(
  CompletableSchema
).extend({
  type: z.enum(['record']),
  children: ChildFragmentsSchema,
});
const AttributeFragmentSchema = CommonFragmentSchema.extend({
  type: z.enum(['attribute']),
  value: CommonFragmentSchema.optional(),
});

// Fragment Types

export type FragmentType =
  | 'string'
  | 'boolean'
  | 'array'
  | 'record'
  | 'attribute';

export interface FragmentCompatible {
  readonly type: FragmentType;
}

export class StringFragment implements FragmentCompatible {
  static readonly schema = StringFragmentSchema;
  readonly type: FragmentType = 'string';
  readonly isComplete = true;
  constructor(readonly value: string) {}
}

export class BooleanFragment implements FragmentCompatible {
  static readonly schema = BooleanFragmentSchema;
  readonly type: FragmentType = 'boolean';
  readonly isComplete = true;
  readonly value: boolean;
  constructor(input: boolean | string) {
    this.value =
      typeof input === 'string' ? StarlarkBoolean.asBoolean(input) : input;
  }
}

export class ArrayFragment implements FragmentCompatible {
  static readonly schema = ArrayFragmentSchema;
  readonly type: FragmentType = 'array';
  isComplete = false;
  items: ValueFragment[] = [];

  constructor(items: ValueFragment[] = [], isComplete = false) {
    this.items = items;
    this.isComplete = isComplete;
  }

  addValue(item: ValueFragment): void {
    this.items.push(item);
  }
}

export class RecordFragment implements FragmentCompatible {
  static readonly schema = RecordFragmentSchema;
  readonly type: FragmentType = 'record';
  isComplete = false;
  children: ChildFragments;

  constructor(children: ChildFragments = {}, isComplete = false) {
    this.children = children;
    this.isComplete = isComplete;
  }

  addAttribute(attrib: AttributeFragment): void {
    if (!attrib.value) {
      throw new Error('The attribute fragment does not have a value.');
    }
    this.children[attrib.name] = attrib.value;
  }
}

export class AttributeFragment implements FragmentCompatible {
  static readonly schema = AttributeFragmentSchema;
  readonly type: FragmentType = 'attribute';
  readonly name: string;
  value?: ValueFragment;

  constructor(name: string, value?: ValueFragment) {
    this.name = name;
    this.value = value;
  }

  get isComplete(): boolean {
    return is.truthy(this.value);
  }

  addValue(item: ValueFragment): void {
    this.value = item;
  }
}

export type ValueFragment =
  | ArrayFragment
  | BooleanFragment
  | RecordFragment
  | StringFragment;
export type ChildFragments = Record<string, ValueFragment>;
export type Fragment = ValueFragment | AttributeFragment;

// Fragments Class

export class Fragments {
  private static typeError(expected: string, actual: string): Error {
    return new Error(`Expected type ${expected}, but was ${actual}.`);
  }

  static safeAsValue(frag: FragmentCompatible): ValueFragment | undefined {
    switch (frag.type) {
      case 'string':
        return Fragments.asString(frag);
      case 'boolean':
        return Fragments.asBoolean(frag);
      case 'array':
        return Fragments.asArray(frag);
      case 'record':
        return Fragments.asRecord(frag);
      default:
        return undefined;
    }
  }

  static asValue(frag: FragmentCompatible): ValueFragment {
    const value = Fragments.safeAsValue(frag);
    if (value) {
      return value;
    }
    throw new Error(`Unexpected fragment type: ${frag.type}`);
  }

  static asFragment(frag: FragmentCompatible): Fragment {
    const value = Fragments.safeAsValue(frag);
    if (value) {
      return value;
    }
    if (frag.type === 'attribute') {
      return Fragments.asAttribute(frag);
    }
    // istanbul ignore next: can only get here if new type addded, but no impl
    throw new Error(`Unexpected fragment type: ${frag.type}`);
  }

  static asBoolean(frag: FragmentCompatible): BooleanFragment {
    if (frag instanceof BooleanFragment) {
      return frag;
    }
    BooleanFragmentSchema.parse(frag);
    Object.setPrototypeOf(frag, BooleanFragment.prototype);
    return frag as BooleanFragment;
  }

  static asString(frag: FragmentCompatible): StringFragment {
    if (frag instanceof StringFragment) {
      return frag;
    }
    StringFragmentSchema.parse(frag);
    Object.setPrototypeOf(frag, StringFragment.prototype);
    return frag as StringFragment;
  }

  static asArray(frag: FragmentCompatible): ArrayFragment {
    if (frag instanceof ArrayFragment) {
      return frag;
    }
    ArrayFragmentSchema.parse(frag);
    Object.setPrototypeOf(frag, ArrayFragment.prototype);
    const array = frag as ArrayFragment;
    for (let i = 0; i < array.items.length; i++) {
      array.items[i] = Fragments.asValue(array.items[i]);
    }
    return array;
  }

  static safeAsRecord(frag: FragmentCompatible): RecordFragment | undefined {
    if (frag instanceof RecordFragment) {
      return frag;
    }
    const parseResult = RecordFragmentSchema.safeParse(frag);
    if (!parseResult.success) {
      return undefined;
    }
    Object.setPrototypeOf(frag, RecordFragment.prototype);
    const record = frag as RecordFragment;
    for (const prop in record.children) {
      const child = record.children[prop];
      record.children[prop] = Fragments.asValue(child);
    }
    return record;
  }

  static asRecord(frag: FragmentCompatible): RecordFragment {
    const record = Fragments.safeAsRecord(frag);
    if (record) {
      return record;
    }
    throw Fragments.typeError('record', frag.type);
  }

  static safeAsAttribute(
    frag: FragmentCompatible
  ): AttributeFragment | undefined {
    if (frag instanceof AttributeFragment) {
      return frag;
    }
    const parseResult = AttributeFragmentSchema.safeParse(frag);
    if (!parseResult.success) {
      return undefined;
    }
    Object.setPrototypeOf(frag, AttributeFragment.prototype);
    const attribute = frag as AttributeFragment;
    if (attribute.value) {
      attribute.value = Fragments.asValue(attribute.value);
    }
    return attribute;
  }

  static asAttribute(frag: FragmentCompatible): AttributeFragment {
    const attribute = Fragments.safeAsAttribute(frag);
    if (attribute) {
      return attribute;
    }
    throw Fragments.typeError('attribute', frag.type);
  }
}

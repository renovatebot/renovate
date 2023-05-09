import is from '@sindresorhus/is';
import { z } from 'zod';
import * as starlark from './starlark';

// Fragment Schemas

interface StringFragmentInterface {
  readonly type: 'string';
  readonly value: string;
}

interface BooleanFragmentInterface {
  readonly type: 'boolean';
  readonly value: boolean;
}

interface ArrayFragmentInterface {
  readonly type: 'array';
  items: ValueFragmentInterface[];
  isComplete: boolean;
}

type ChildFragmentsInterface = Record<string, ValueFragmentInterface>;

interface RecordFragmentInterface {
  readonly type: 'record';
  children: ChildFragmentsInterface;
  isComplete: boolean;
}

type ValueFragmentInterface =
  | StringFragmentInterface
  | BooleanFragmentInterface
  | ArrayFragmentInterface
  | RecordFragmentInterface;

export const ValueFragmentSchema: z.ZodType<ValueFragmentInterface> = z.lazy(
  () =>
    z.discriminatedUnion('type', [
      z.object({ type: z.literal('string'), value: z.string() }),
      z.object({ type: z.literal('boolean'), value: z.boolean() }),
      z.object({
        type: z.literal('array'),
        items: ValueFragmentSchema.array(),
        isComplete: z.boolean(),
      }),
      z.object({
        type: z.literal('record'),
        children: z.record(z.string(), ValueFragmentSchema),
        isComplete: z.boolean(),
      }),
    ])
);

const AttributeFragmentSchema = z.object({
  type: z.literal('attribute'),
  name: z.string(),
  value: ValueFragmentSchema.optional(),
});

// Fragment Types

export type FragmentType =
  | 'string'
  | 'boolean'
  | 'array'
  | 'record'
  | 'attribute';

export class StringFragment {
  static as(data: unknown): StringFragment {
    return as(
      data,
      StringFragment,
      (v: ValueFragmentInterface): v is StringFragmentInterface =>
        v.type === 'string',
      StringFragment.from
    );
  }

  static from(frag: StringFragmentInterface): StringFragment {
    return new StringFragment(frag.value);
  }

  readonly type: FragmentType = 'string';
  readonly isComplete = true;
  constructor(readonly value: string) {}
}

export class BooleanFragment {
  static as(data: unknown): BooleanFragment {
    return as(
      data,
      BooleanFragment,
      (v: ValueFragmentInterface): v is BooleanFragmentInterface =>
        v.type === 'boolean',
      BooleanFragment.from
    );
  }

  static from(frag: BooleanFragmentInterface): BooleanFragment {
    return new BooleanFragment(frag.value);
  }

  readonly type: FragmentType = 'boolean';
  readonly isComplete = true;
  readonly value: boolean;
  constructor(input: boolean | string) {
    this.value = typeof input === 'string' ? starlark.asBoolean(input) : input;
  }
}

export class ArrayFragment {
  static as(data: unknown): ArrayFragment {
    return as(
      data,
      ArrayFragment,
      (v: ValueFragmentInterface): v is ArrayFragmentInterface =>
        v.type === 'array',
      ArrayFragment.from
    );
  }

  static from(frag: ArrayFragmentInterface): ArrayFragment {
    return new ArrayFragment(
      frag.items.map((item) => asValue(item)),
      frag.isComplete
    );
  }

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

export class RecordFragment {
  static as(data: unknown): RecordFragment {
    return as(
      data,
      RecordFragment,
      (v: ValueFragmentInterface): v is RecordFragmentInterface =>
        v.type === 'record',
      RecordFragment.from
    );
  }

  static from(frag: RecordFragmentInterface): RecordFragment {
    const children: ChildFragments = Object.entries(frag.children).reduce(
      (acc, propVal) => {
        acc[propVal[0]] = asValue(propVal[1]);
        return acc;
      },
      {} as ChildFragments
    );
    return new RecordFragment(children, frag.isComplete);
  }

  static safeAs(data: unknown): RecordFragment | null {
    try {
      return RecordFragment.as(data);
    } catch (e) {
      return null;
    }
  }

  readonly type: FragmentType = 'record';
  isComplete: boolean;
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

export class AttributeFragment {
  static as(data: unknown): AttributeFragment {
    if (data instanceof AttributeFragment) {
      return data;
    }
    const frag = AttributeFragmentSchema.parse(data);
    return new AttributeFragment(
      frag.name,
      frag.value ? asValue(frag.value) : undefined
    );
  }

  static safeAs(data: unknown): AttributeFragment | null {
    try {
      return AttributeFragment.as(data);
    } catch (e) {
      return null;
    }
  }

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

// Static Functions

function as<I extends ValueFragmentInterface, F>(
  data: unknown,
  fragCtor: new (...args: any[]) => F,
  iTypeGuard: (v: ValueFragmentInterface) => v is I,
  fromFn: (frag: I) => F
): F {
  if (data instanceof fragCtor) {
    return data;
  }
  const fragInterface = ValueFragmentSchema.parse(data);
  if (iTypeGuard(fragInterface)) {
    return fromFn(fragInterface);
  }
  throw new Error(`Incorrect value fragment type: ${fragInterface.type}.`);
}

export function asValue(data: unknown): ValueFragment {
  const frag = ValueFragmentSchema.parse(data);
  switch (frag.type) {
    case 'string':
      return StringFragment.from(frag);
    case 'boolean':
      return BooleanFragment.from(frag);
    case 'array':
      return ArrayFragment.from(frag);
    case 'record':
      return RecordFragment.from(frag);
    default:
      throw new Error('Unexpected fragment type.');
  }
}

export function safeAsValue(data: unknown): ValueFragment | null {
  try {
    return asValue(data);
  } catch (e) {
    return null;
  }
}

export function asFragment(data: unknown): Fragment {
  const value = safeAsValue(data);
  if (value) {
    return value;
  }
  return AttributeFragment.as(data);
}

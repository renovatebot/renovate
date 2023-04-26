import is from '@sindresorhus/is';

export type FragmentType = 'string' | 'array' | 'record' | 'attribute';

export interface FragmentCompatible {
  readonly type: FragmentType;
}

export class StringFragment implements FragmentCompatible {
  readonly type: FragmentType = 'string';
  readonly isComplete = true;
  constructor(readonly value: string) {}
}

export class ArrayFragment implements FragmentCompatible {
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

export type ValueFragment = ArrayFragment | RecordFragment | StringFragment;
export type ChildFragments = Record<string, ValueFragment>;
export type Fragment = ValueFragment | AttributeFragment;

export class Fragments {
  private static typeError(expected: string, actual: string): Error {
    return new Error(`Expected type ${expected}, but was ${actual}.`);
  }

  private static checkType(expected: string, actual: string): void {
    if (expected === actual) {
      return;
    }
    throw Fragments.typeError(expected, actual);
  }

  static safeAsValue(frag: FragmentCompatible): ValueFragment | undefined {
    switch (frag.type) {
      case 'string':
        return Fragments.asString(frag);
        break;
      case 'array':
        return Fragments.asArray(frag);
        break;
      case 'record':
        return Fragments.asRecord(frag);
        break;
      default:
        return undefined;
    }
  }

  static asValue(frag: FragmentCompatible): ValueFragment {
    const value = Fragments.safeAsValue(frag);
    if (value) {
      return value;
    }
    throw new Error(`Unexpected fragment type. ${frag.type}`);
  }

  static asFragment(frag: FragmentCompatible): Fragment {
    const value = Fragments.safeAsValue(frag);
    if (value) {
      return value;
    }
    if (frag.type === 'attribute') {
      return Fragments.asAttribute(frag);
    }
    throw new Error(`Unexpected fragment type. ${frag.type}`);
  }

  static asString(frag: FragmentCompatible): StringFragment {
    Fragments.checkType('string', frag.type);
    Object.setPrototypeOf(frag, StringFragment.prototype);
    return frag as StringFragment;
  }

  static asArray(frag: FragmentCompatible): ArrayFragment {
    Fragments.checkType('array', frag.type);
    Object.setPrototypeOf(frag, ArrayFragment.prototype);
    const array = frag as ArrayFragment;
    for (let i = 0; i < array.items.length; i++) {
      array.items[i] = Fragments.asValue(array.items[i]);
    }
    return array;
  }

  static asRecord(frag: FragmentCompatible): RecordFragment {
    Fragments.checkType('record', frag.type);
    Object.setPrototypeOf(frag, RecordFragment.prototype);
    const record = frag as RecordFragment;
    for (const prop in record.children) {
      const child = record.children[prop];
      record.children[prop] = Fragments.asValue(child);
    }
    return record;
  }

  static safeAsAttribute(
    frag: FragmentCompatible
  ): AttributeFragment | undefined {
    if (frag.type !== 'attribute') {
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
    throw this.typeError('attribute', frag.type);
  }
}

import type {
  AllFragments,
  ArrayFragment,
  ChildFragments,
  RecordFragment,
} from './fragments';
import * as fragments from './fragments';

// Represents the fields that the context must have.
export interface CtxCompatible {
  results: RecordFragment[];
  stack: AllFragments[];
}

export class CtxProcessingError extends Error {
  readonly current: AllFragments;
  readonly parent?: AllFragments;
  constructor(current: AllFragments, parent?: AllFragments) {
    const msg = `Invalid context state. current: ${current.type}, parent: ${
      parent?.type ?? 'none'
    }`;
    super(msg);
    this.name = 'CtxProcessingError';
    this.current = current;
    this.parent = parent;
  }
}

export class Ctx implements CtxCompatible {
  results: RecordFragment[];
  stack: AllFragments[];

  constructor(results: RecordFragment[] = [], stack: AllFragments[] = []) {
    this.results = results;
    this.stack = stack;
  }

  private get safeCurrent(): AllFragments | undefined {
    return this.stack.at(-1);
  }

  private get current(): AllFragments {
    const c = this.safeCurrent;
    if (c === undefined) {
      throw new Error('Requested current, but no value.');
    }
    return c;
  }
  get currentRecord(): RecordFragment {
    const current = this.current;
    if (current.type === 'record') {
      return current;
    }
    throw new Error('Requested current record, but does not exist.');
  }

  get currentArray(): ArrayFragment {
    const current = this.current;
    if (current.type === 'array') {
      return current;
    }
    throw new Error('Requested current array, but does not exist.');
  }

  private popStack(): boolean {
    const current = this.stack.pop();
    if (!current) {
      return false;
    }
    if (!current.isComplete) {
      this.stack.push(current);
      return false;
    }
    const parent = this.safeCurrent;

    if (parent) {
      if (parent.type === 'attribute' && fragments.isValue(current)) {
        parent.value = current;
        parent.isComplete = true;
        return true;
      }
      if (parent.type === 'array' && fragments.isPrimitive(current)) {
        parent.items.push(current);
        return true;
      }
      if (
        parent.type === 'record' &&
        current.type === 'attribute' &&
        current.value !== undefined
      ) {
        parent.children[current.name] = current.value;
        return true;
      }
    } else if (current.type === 'record') {
      this.results.push(current);
      return true;
    }

    throw new CtxProcessingError(current, parent);
  }

  private processStack(): Ctx {
    while (this.popStack()) {
      // Nothing to do
    }
    return this;
  }

  addString(value: string): Ctx {
    this.stack.push(fragments.string(value));
    return this.processStack();
  }

  addBoolean(value: string | boolean): Ctx {
    this.stack.push(fragments.boolean(value));
    return this.processStack();
  }

  startRecord(children: ChildFragments = {}): Ctx {
    const record = fragments.record(children);
    this.stack.push(record);
    return this;
  }

  endRecord(): Ctx {
    const record = this.currentRecord;
    record.isComplete = true;
    return this.processStack();
  }

  startRule(name: string): Ctx {
    return this.startRecord({ rule: fragments.string(name) });
  }

  endRule(): Ctx {
    return this.endRecord();
  }

  startAttribute(name: string): Ctx {
    this.stack.push(fragments.attribute(name));
    return this.processStack();
  }

  startArray(): Ctx {
    this.stack.push(fragments.array());
    return this.processStack();
  }

  endArray(): Ctx {
    const array = this.currentArray;
    array.isComplete = true;
    return this.processStack();
  }
}

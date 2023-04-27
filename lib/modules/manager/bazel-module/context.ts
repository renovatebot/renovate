import {
  ArrayFragment,
  AttributeFragment,
  ChildFragments,
  Fragment,
  Fragments,
  RecordFragment,
  StringFragment,
  ValueFragment,
} from './fragments';
import { Stack } from './stack';

// Represents the fields that the context must have.
export interface CtxCompatible {
  results: ValueFragment[];
  stack: Stack<Fragment>;
}

export class Ctx implements CtxCompatible {
  results: ValueFragment[] = [];
  stack = Stack.create<Fragment>();

  // This exists because the good-enough-parser gives a cloned instance of our
  // Ctx. It is missing the Ctx prototype. This function adds the proper prototype
  // to the context and the items referenced by the context.
  static from(obj: CtxCompatible): Ctx {
    Object.setPrototypeOf(obj, Ctx.prototype);
    const ctx = obj as Ctx;
    const stackItems = ctx.stack.map((item) => Fragments.asFragment(item));
    ctx.stack = Stack.create(...stackItems);
    ctx.results = ctx.results.map((item) => Fragments.asRecord(item));
    return ctx;
  }

  get currentRecord(): RecordFragment {
    const current = this.stack.current;
    if (current instanceof RecordFragment) {
      return current;
    }
    throw new Error('Requested current record, but does not exist.');
  }

  get currentArray(): ArrayFragment {
    const current = this.stack.current;
    if (current instanceof ArrayFragment) {
      return current;
    }
    throw new Error('Requested current array, but does not exist.');
  }

  private popStack(): void {
    const current = this.stack.pop();
    // istanbul ignore if: we should never get here
    if (!current) {
      return;
    }
    const value = Fragments.safeAsValue(current);
    const attribute = Fragments.safeAsAttribute(current);
    const newCurrent = this.stack.safeCurrent;
    if (value) {
      if (newCurrent && 'addValue' in newCurrent) {
        newCurrent.addValue(value);
        return;
      }
      if (!newCurrent) {
        this.results.push(value);
        return;
      }
    } else if (attribute) {
      if (newCurrent && 'addAttribute' in newCurrent) {
        newCurrent.addAttribute(attribute);
        return;
      }
      if (!newCurrent) {
        throw new Error('Processing an attribute but there is no parent.');
      }
    }
    // istanbul ignore next: catching future mistakes
    throw new Error('We are in a bad place.');
  }

  private processStack(): Ctx {
    let current = this.stack.safeCurrent;
    while (current?.isComplete) {
      this.popStack();
      current = this.stack.safeCurrent;
    }
    return this;
  }

  addString(value: string): Ctx {
    this.stack.push(new StringFragment(value));
    return this.processStack();
  }

  startRecord(children: ChildFragments = {}): Ctx {
    const record = new RecordFragment(children);
    this.stack.push(record);
    return this;
  }

  endRecord(): Ctx {
    const record = this.currentRecord;
    record.isComplete = true;
    return this.processStack();
  }

  startRule(name: string): Ctx {
    return this.startRecord({ rule: new StringFragment(name) });
  }

  endRule(): Ctx {
    return this.endRecord();
  }

  startAttribute(name: string): Ctx {
    this.stack.push(new AttributeFragment(name));
    return this.processStack();
  }

  startArray(): Ctx {
    this.stack.push(new ArrayFragment());
    return this.processStack();
  }

  addArrayItem(value: string): Ctx {
    const array = this.currentArray;
    array.items.push(new StringFragment(value));
    return this;
  }

  endArray(): Ctx {
    const array = this.currentArray;
    array.isComplete = true;
    return this.processStack();
  }
}

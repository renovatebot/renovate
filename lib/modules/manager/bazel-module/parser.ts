import { lang, query as q } from 'good-enough-parser';
import { logger } from '../../../logger';
import { supportedRulesRegex } from './rules';
import {
  AttributeFragment,
  ChildFragments,
  Fragment,
  Fragments,
  RecordFragment,
  Stack,
  StringFragment,
} from './types';

// Represents the fields that the context must have.
export interface CtxCompatible {
  results: RecordFragment[];
  stack: Stack<Fragment>;
}

export class Ctx implements CtxCompatible {
  results: RecordFragment[] = [];
  stack = Stack.create<Fragment>();

  // This exists because the good-enough-parser gives a cloned instance of our
  // Ctx instance. This instance is missing the Ctx prototype.
  static from(obj: CtxCompatible): Ctx {
    Object.setPrototypeOf(obj, Ctx.prototype);
    const ctx = obj as Ctx;
    const stackItems = ctx.stack.map((item) => Fragments.asFragment(item));
    ctx.stack = Stack.create(...stackItems);
    ctx.results = ctx.results.map((item) => Fragments.asRecord(item));
    return ctx;
  }

  private newError(msg: string): Error {
    return new Error(`${msg} ctx: ${JSON.stringify(this)}`);
  }

  get currentRecord(): RecordFragment {
    const current = this.stack.current;
    if (current instanceof RecordFragment) {
      return current;
    }
    throw this.newError('Requested current record, but does not exist.');
  }

  get currentAttribute(): AttributeFragment {
    const current = this.stack.current;
    if (current instanceof AttributeFragment) {
      return current;
    }
    throw this.newError('Requested current attribute, but does not exist.');
  }

  startRecord(children: ChildFragments): Ctx {
    const record = new RecordFragment(children);
    this.stack.push(record);
    return this;
  }

  endRecord(): Ctx {
    const record = this.currentRecord;
    this.results.push(record);
    this.stack.pop();
    return this;
  }

  startRule(name: string): Ctx {
    return this.startRecord({ rule: new StringFragment(name) });
  }

  endRule(): Ctx {
    return this.endRecord();
  }

  startAttribute(name: string): Ctx {
    this.stack.push(new AttributeFragment(name));
    return this;
  }

  setAttributeValue(value: string): Ctx {
    const attrib = this.currentAttribute;
    attrib.value = new StringFragment(value);
    return this.endAttribute();
  }

  endAttribute(): Ctx {
    const attrib = this.currentAttribute;
    if (!attrib.value) {
      throw this.newError(`No value was set for the attribute. ${attrib.name}`);
    }
    this.stack.pop();
    const record = this.currentRecord;
    record.children[attrib.name] = attrib.value;
    return this;
  }
}

/**
 * Matches key-value pairs:
 * - `tag = "1.2.3"`
 * - `name = "foobar"`
 * - `deps = ["foo", "bar"]`
 * - `
 *     artifacts = [
         maven.artifact(
           group = "com.example1",
           artifact = "foobar",
           version = "1.2.3",
         )
       ]
     `
 **/
const kwParams = q
  .sym<Ctx>((ctx, token) => {
    return Ctx.from(ctx).startAttribute(token.value);
  })
  .op('=')
  .str((ctx, token) => {
    return Ctx.from(ctx).setAttributeValue(token.value);
  });

const moduleRules = q
  .sym<Ctx>(supportedRulesRegex, (ctx, token) => {
    return Ctx.from(ctx).startRule(token.value);
  })
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kwParams,
      postHandler: (ctx, tree) => {
        return Ctx.from(ctx).endRule();
      },
    })
  );

const rule = q.alt<Ctx>(moduleRules);

const query = q.tree<Ctx>({
  type: 'root-tree',
  maxDepth: 16,
  search: rule,
});

const starlark = lang.createLang('starlark');

export function parse(
  input: string,
  packageFile?: string
): RecordFragment[] | null {
  // TODO: Add the mem cache.

  let result: RecordFragment[] | null = null;
  try {
    const parsedResult = starlark.query(input, query, new Ctx());
    if (parsedResult) {
      result = parsedResult.results;
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Bazel parsing error');
  }

  return result;
}

// // export class Parser {
// //   static readonly starlark = lang.createLang('starlark');
// //   constructor(readonly input: string, readonly packageFile?: string) {}
// // }

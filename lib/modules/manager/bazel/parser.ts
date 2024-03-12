import { lang, lexer, parser, query as q } from 'good-enough-parser';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import { hash } from '../../../util/hash';
import { supportedRulesRegex } from './rules';
import type { NestedFragment, RecordFragment } from './types';

interface Ctx {
  readonly source: string;
  results: RecordFragment[];
  stack: NestedFragment[];
  recordKey?: string;
  subRecordKey?: string;
  argIndex?: number;
}

function emptyCtx(source: string): Ctx {
  return {
    source,
    results: [],
    stack: [],
  };
}

function currentFragment(ctx: Ctx): NestedFragment {
  const deepestFragment = ctx.stack[ctx.stack.length - 1];
  return deepestFragment;
}

function extractTreeValue(
  source: string,
  tree: parser.Tree,
  offset: number,
): string {
  if (tree.type === 'wrapped-tree') {
    const { endsWith } = tree;
    const to = endsWith.offset + endsWith.value.length;
    return source.slice(offset, to);
  }

  // istanbul ignore next
  return '';
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
  .sym<Ctx>((ctx, { value: recordKey }) => {
    return { ...ctx, recordKey };
  })
  .op('=')
  .alt(
    // string
    q.str((ctx, { offset, value }) => {
      const frag = currentFragment(ctx);
      if (frag.type === 'record' && ctx.recordKey) {
        const key = ctx.recordKey;
        frag.children[key] = { type: 'string', value, offset };
      }
      return ctx;
    }),
    // array of strings or calls
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      startsWith: '[',
      endsWith: ']',
      preHandler: (ctx, tree) => {
        const parentRecord = currentFragment(ctx) as RecordFragment;
        if (
          parentRecord.type === 'record' &&
          ctx.recordKey &&
          tree.type === 'wrapped-tree'
        ) {
          const key = ctx.recordKey;
          parentRecord.children[key] = {
            type: 'array',
            value: '',
            offset: tree.startsWith.offset,
            children: [],
          };
        }
        return ctx;
      },
      search: q.alt(
        q.str<Ctx>((ctx, { value, offset }) => {
          const parentRecord = currentFragment(ctx);
          if (parentRecord.type === 'record' && ctx.recordKey) {
            const key = ctx.recordKey;
            const array = parentRecord.children[key];
            if (array.type === 'array') {
              array.children.push({ type: 'string', value, offset });
            }
          }
          return ctx;
        }),
        q
          .sym<Ctx>()
          .handler(recordStartHandler)
          .handler((ctx, { value, offset }) => {
            const ruleFragment = currentFragment(ctx);
            if (ruleFragment.type === 'record') {
              ruleFragment.children._function = {
                type: 'string',
                value,
                offset,
              };
            }
            return ctx;
          })
          .many(
            q.op<Ctx>('.').sym((ctx, { value }) => {
              const ruleFragment = currentFragment(ctx);
              if (
                ruleFragment.type === 'record' &&
                ruleFragment.children._function
              ) {
                ruleFragment.children._function.value += `.${value}`;
              }
              return ctx;
            }),
            0,
            3,
          )
          .tree({
            type: 'wrapped-tree',
            maxDepth: 1,
            startsWith: '(',
            endsWith: ')',
            search: q
              .opt(
                q
                  .sym<Ctx>((ctx, { value: subRecordKey }) => ({
                    ...ctx,
                    subRecordKey,
                  }))
                  .op('='),
              )
              .str((ctx, { value: subRecordValue, offset }) => {
                const argIndex = ctx.argIndex ?? 0;

                const subRecordKey = ctx.subRecordKey! ?? argIndex.toString();
                const ruleFragment = currentFragment(ctx);
                if (ruleFragment.type === 'record') {
                  ruleFragment.children[subRecordKey] = {
                    type: 'string',
                    value: subRecordValue,
                    offset,
                  };
                }
                delete ctx.subRecordKey;
                ctx.argIndex = argIndex + 1;
                return ctx;
              }),
            postHandler: (ctx, tree) => {
              delete ctx.argIndex;

              const callFrag = currentFragment(ctx);
              ctx.stack.pop();
              if (callFrag.type === 'record' && tree.type === 'wrapped-tree') {
                callFrag.value = extractTreeValue(
                  ctx.source,
                  tree,
                  callFrag.offset,
                );

                const parentRecord = currentFragment(ctx);
                if (parentRecord.type === 'record' && ctx.recordKey) {
                  const key = ctx.recordKey;
                  const array = parentRecord.children[key];
                  if (array.type === 'array') {
                    array.children.push(callFrag);
                  }
                }
              }
              return ctx;
            },
          }),
      ),
      postHandler: (ctx, tree) => {
        const parentRecord = currentFragment(ctx);
        if (
          parentRecord.type === 'record' &&
          ctx.recordKey &&
          tree.type === 'wrapped-tree'
        ) {
          const key = ctx.recordKey;
          const array = parentRecord.children[key];
          if (array.type === 'array') {
            array.value = extractTreeValue(ctx.source, tree, array.offset);
          }
        }
        return ctx;
      },
    }),
  )
  .handler((ctx) => {
    delete ctx.recordKey;
    return ctx;
  });

/**
 * Matches rule signature:
 *   `git_repository(......)`
 *                  ^^^^^^^^
 *
 * @param search something to match inside parens
 */
function ruleCall(
  search: q.QueryBuilder<Ctx, parser.Node>,
): q.QueryBuilder<Ctx, parser.Node> {
  return q.tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    search,
    postHandler: (ctx, tree) => {
      const frag = currentFragment(ctx);
      if (frag.type === 'record' && tree.type === 'wrapped-tree') {
        frag.value = extractTreeValue(ctx.source, tree, frag.offset);
        ctx.stack.pop();
        ctx.results.push(frag);
      }

      return ctx;
    },
  });
}

function recordStartHandler(ctx: Ctx, { offset }: lexer.Token): Ctx {
  ctx.stack.push({
    type: 'record',
    value: '',
    offset,
    children: {},
  });
  return ctx;
}

function ruleNameHandler(ctx: Ctx, { value, offset }: lexer.Token): Ctx {
  const ruleFragment = currentFragment(ctx);
  if (ruleFragment.type === 'record') {
    ruleFragment.children['rule'] = { type: 'string', value, offset };
  }

  return ctx;
}

/**
 * Matches regular rules:
 * - `git_repository(...)`
 * - `_go_repository(...)`
 */
const regularRule = q
  .sym<Ctx>(supportedRulesRegex, (ctx, token) =>
    ruleNameHandler(recordStartHandler(ctx, token), token),
  )
  .join(ruleCall(kwParams));

/**
 * Matches "maybe"-form rules:
 * - `maybe(git_repository, ...)`
 * - `maybe(_go_repository, ...)`
 */
const maybeRule = q
  .sym<Ctx>('maybe', recordStartHandler)
  .join(
    ruleCall(
      q.alt(
        q.begin<Ctx>().sym(supportedRulesRegex, ruleNameHandler).op(','),
        kwParams,
      ),
    ),
  );

const rule = q.alt<Ctx>(maybeRule, regularRule);

const query = q.tree<Ctx>({
  type: 'root-tree',
  maxDepth: 16,
  search: rule,
});

function getCacheKey(input: string): string {
  const hashedInput = hash(input);
  return `bazel-parser-${hashedInput}`;
}

const starlark = lang.createLang('starlark');

export function parse(
  input: string,
  packageFile?: string,
): RecordFragment[] | null {
  const cacheKey = getCacheKey(input);

  const cachedResult = memCache.get<RecordFragment[] | null>(cacheKey);
  // istanbul ignore if
  if (cachedResult === null || cachedResult) {
    return cachedResult;
  }

  let result: RecordFragment[] | null = null;
  try {
    const parsedResult = starlark.query(input, query, emptyCtx(input));
    if (parsedResult) {
      result = parsedResult.results;
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Bazel parsing error');
  }

  memCache.set(cacheKey, result);
  return result;
}

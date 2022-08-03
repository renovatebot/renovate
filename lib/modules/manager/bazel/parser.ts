import crypto from 'crypto';
import is from '@sindresorhus/is';
import { lang, query as q } from 'good-enough-parser';
import * as memCache from '../../../util/cache/memory';
import { regEx } from '../../../util/regex';
import type { MetaPath, ParsedResult, Target, TargetAttribute } from './types';
import { ruleMappers } from './util';

function isTarget(target: Partial<Target>): target is Target {
  return !!target.rule && !!target.name;
}

interface Ctx extends ParsedResult {
  currentTarget: Partial<Target>;
  currentAttrKey?: string;
  currentAttrVal?: TargetAttribute;
  currentArray?: string[];
  currentMetaPath: MetaPath;
  ruleIndex: number;
  ruleStartOffset?: number; // deprecated
}

const emptyCtx: Ctx = {
  targets: [],
  meta: [],
  currentTarget: {},
  currentMetaPath: [],
  ruleIndex: 0,
};

const starlark = lang.createLang('starlark');

const ruleRegex = regEx(`^${Object.keys(ruleMappers).join('|')}$`);

/**
 * Matches rule type:
 * - `git_repository`
 * - `go_repository`
 **/
const ruleSym = q.sym<Ctx>(ruleRegex, (ctx, { value, offset }) => {
  ctx.currentTarget.rule = value;

  // TODO: remove it (#9667)
  if (!is.number(ctx.ruleStartOffset)) {
    ctx.ruleStartOffset = offset;
  }

  return ctx;
});

/**
 * Matches key-value pairs:
 * - `tag = "1.2.3"`
 * - `name = "foobar"`
 * - `deps = ["foo", "bar"]`
 **/
const kwParams = q
  .sym<Ctx>((ctx, { value }) => {
    ctx.currentAttrKey = value;
    const leaf = ctx.currentMetaPath.pop();
    if (is.number(leaf)) {
      ctx.currentMetaPath.push(leaf);
    }
    ctx.currentMetaPath.push(value);
    return ctx;
  })
  .op('=')
  .alt(
    // string case
    q.str((ctx, { offset, value }) => {
      ctx.currentTarget[ctx.currentAttrKey!] = value;
      ctx.meta.push({
        path: [...ctx.currentMetaPath],
        data: { offset: offset, length: value.length },
      });
      return ctx;
    }),
    // array of strings case
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      preHandler: (ctx) => {
        ctx.currentArray = [];
        return ctx;
      },
      search: q.str<Ctx>((ctx, { value, offset }) => {
        ctx.meta.push({
          path: [...ctx.currentMetaPath, ctx.currentArray!.length],
          data: { offset: offset, length: value.length },
        });
        ctx.currentArray?.push(value);
        return ctx;
      }),
      postHandler: (ctx) => {
        ctx.currentTarget[ctx.currentAttrKey!] = ctx.currentArray;
        ctx.currentArray = [];
        return ctx;
      },
    })
  );

/**
 * Matches rule signature, i.e. content of `git_repository(...)`
 *
 * @param search something to match inside parens
 */
function ruleCall(search: q.QueryBuilder<Ctx>): q.QueryBuilder<Ctx> {
  return q.tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    preHandler: (ctx) => {
      ctx.currentMetaPath.push(ctx.ruleIndex);
      return ctx;
    },
    search,
    postHandler: (ctx, tree) => {
      // TODO: remove it (#9667)
      if (is.number(ctx.ruleStartOffset) && tree.type === 'wrapped-tree') {
        const { children, endsWith } = tree;
        const lastElem = children[children.length - 1];
        if (lastElem.type === '_end') {
          const ruleEndOffset = lastElem.offset + endsWith.value.length;
          const offset = ctx.ruleStartOffset;
          const length = ruleEndOffset - ctx.ruleStartOffset;
          ctx.meta.push({
            path: [ctx.ruleIndex],
            data: { offset, length },
          });
          delete ctx.ruleStartOffset;
        }
      }

      if (isTarget(ctx.currentTarget)) {
        ctx.targets.push(ctx.currentTarget);
      }
      ctx.currentTarget = {};
      ctx.ruleIndex += 1;
      ctx.currentMetaPath.pop();

      return ctx;
    },
  });
}

/**
 * Matches regular rules:
 * - `git_repository(...)`
 * - `go_repository(...)`
 */
const regularRule = ruleSym.join(ruleCall(kwParams));

const maybeFirstArg = q.begin<Ctx>().join(ruleSym).op(',');

/**
 * Matches "maybe"-form rules:
 * - `maybe(git_repository, ...)`
 * - `maybe(go_repository, ...)`
 */
const maybeRule = q
  .sym<Ctx>(
    'maybe',
    // TODO: remove it (#9667)
    (ctx, { offset }) => {
      if (!is.number(ctx.ruleStartOffset)) {
        ctx.ruleStartOffset = offset;
      }
      return ctx;
    }
  )
  .join(ruleCall(q.alt(maybeFirstArg, kwParams)));

const rule = q.alt<Ctx>(maybeRule, regularRule);

const query = q.tree<Ctx>({
  type: 'root-tree',
  maxDepth: 256,
  search: rule,
});

function getCacheKey(input: string): string {
  const hash = crypto.createHash('md5').update(input).digest('hex');
  return `bazel-parser-${hash}`;
}

export function parse(input: string, ctx = emptyCtx): ParsedResult | null {
  const cacheKey = getCacheKey(input);

  const cachedResult = memCache.get<ParsedResult | null>(cacheKey);
  // istanbul ignore if
  if (cachedResult === null || cachedResult) {
    return cachedResult;
  }

  const parsedResult = starlark.query(input, query, ctx);

  let result: ParsedResult | null = null;

  if (parsedResult) {
    const { targets, meta: meta } = parsedResult;
    result = { targets, meta: meta };
  }

  memCache.set(cacheKey, result);
  return result;
}

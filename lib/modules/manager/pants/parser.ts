import type { lexer, parser } from '@renovatebot/good-enough-parser';
import { lang, query as q } from '@renovatebot/good-enough-parser';
import { regEx } from '../../../util/regex.ts';
import type { PantsTarget, PantsTargetType, PantsToken } from './types.ts';

// BUILD.pants files are evaluated by Pants as Python, so the Python grammar
// tokenizes them correctly, including comments, implicit string concatenation
// and calls such as `resolve=parametrize(...)`.
const python = lang.createLang('python');

interface Ctx {
  targets: PantsTarget[];
  target?: PantsTarget;
  attr?: string;
}

const targetTypes: PantsTargetType[] = [
  'python_requirement',
  'python_requirements',
  'poetry_requirements',
  'uv_requirements',
];

// Only the attributes we consume. Anything else, such as `module_mapping`,
// `overrides` or `resolve`, is skipped, so the string values in those fields
// can never be mistaken for requirements.
const attrNameRegex = regEx(/^(?:name|requirements|source)$/);

function startTarget(ctx: Ctx, type: PantsTargetType): Ctx {
  return {
    ...ctx,
    target: { type, requirements: [] },
    attr: undefined,
  };
}

function endTarget(ctx: Ctx): Ctx {
  // v8 ignore next 3 -- unreachable: the target is opened by the call matcher
  if (!ctx.target) {
    return ctx;
  }
  return {
    ...ctx,
    targets: [...ctx.targets, ctx.target],
    target: undefined,
    attr: undefined,
  };
}

function startAttr(ctx: Ctx, attr: string): Ctx {
  return { ...ctx, attr };
}

function addString(ctx: Ctx, token: lexer.StringValueToken): Ctx {
  const { target, attr } = ctx;
  // v8 ignore next 3 -- unreachable: strings only match inside an attribute
  if (!target || !attr) {
    return ctx;
  }

  const value: PantsToken = { value: token.value, line: token.line };
  switch (attr) {
    case 'name':
      return { ...ctx, target: { ...target, name: value.value } };
    case 'source':
      return { ...ctx, target: { ...target, source: value } };
    case 'requirements':
      return {
        ...ctx,
        target: { ...target, requirements: [...target.requirements, value] },
      };
    // v8 ignore next 2 -- unreachable: attrNameRegex allows nothing else
    default:
      return ctx;
  }
}

const stringValue = q.str<Ctx>(addString);

/**
 * Matches a target attribute holding a string or a list of strings:
 * - `name = "foo"`
 * - `requirements = ["foo==1.2.3", "bar>=1"]`
 */
const attribute = q
  .sym<Ctx>(attrNameRegex, (ctx, token) => startAttr(ctx, token.value))
  .op('=')
  .alt(
    stringValue,
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      startsWith: '[',
      endsWith: ']',
      search: q.many(stringValue),
    }),
  );

const targetArgs = q.tree<Ctx>({
  type: 'wrapped-tree',
  maxDepth: 1,
  search: attribute,
  postHandler: endTarget,
});

// One matcher per target type, so the type carried into the context is the
// literal that matched rather than whatever the file happened to say.
const targetCall = q.alt<Ctx>(
  ...targetTypes.map((type) =>
    q.sym<Ctx>(type, (ctx) => startTarget(ctx, type)).join(targetArgs),
  ),
);

const query = q.tree<Ctx>({
  type: 'root-tree',
  maxDepth: 16,
  search: targetCall,
});

export function parse(content: string): PantsTarget[] {
  const res = python.query<Ctx, parser.Node>(content, query, { targets: [] });
  return res?.targets ?? [];
}

import type { lexer, parser } from '@renovatebot/good-enough-parser';
import { lang, query as q } from '@renovatebot/good-enough-parser';
import { regEx } from '../../../util/regex.ts';
import type {
  PantsRequirement,
  PantsTarget,
  PantsTargetType,
} from './types.ts';

// Pants evaluates build files as Python, so the Python grammar tokenizes them
// correctly, including implicit string concatenation and calls.
const python = lang.createLang('python');

interface Ctx {
  targets: PantsTarget[];
  target?: PantsTarget;
  attr?: string;
  /**
   * Whether a comma has closed the previous element of the value being read.
   * Python joins adjacent string literals, so only a comma starts a new one.
   */
  afterComma?: boolean;
  /**
   * Whether the element being read has been abandoned, because an operator
   * showed that its value is computed rather than written. Literals are
   * ignored until the next comma.
   */
  skipElement?: boolean;
  /**
   * The field as it stood before the attribute being read, so that an
   * expression around the whole value can put it back. Abandoning an element is
   * not enough there: the choice of value is unknown, not the parts of one.
   */
  attrBaseline?: Pick<PantsTarget, 'name' | 'requirements' | 'source'>;
}

const targetTypes: PantsTargetType[] = [
  'python_requirement',
  'python_requirements',
  'poetry_requirements',
  'uv_requirements',
];

// Only the attributes we consume, so that string values in fields such as
// `module_mapping` or `overrides` cannot be mistaken for requirements.
const attrNameRegex = regEx(/^(?:name|requirements|source)$/);

function startTarget(ctx: Ctx, type: PantsTargetType): Ctx {
  return {
    ...ctx,
    target: { type, requirements: [] },
    attr: undefined,
    // Reset here as well as in `startAttr`, so no state can cross from one
    // target to the next.
    afterComma: true,
    skipElement: false,
  };
}

function endTarget(ctx: Ctx): Ctx {
  // v8 ignore next -- unreachable: the target is opened by the call matcher
  if (!ctx.target) {
    return ctx;
  }
  return {
    ...ctx,
    targets: [...ctx.targets, ctx.target],
    target: undefined,
    attr: undefined,
    afterComma: true,
    skipElement: false,
  };
}

function startAttr(ctx: Ctx, attr: string): Ctx {
  const { target } = ctx;
  const started = { ...ctx, attr, afterComma: true, skipElement: false };
  // v8 ignore next -- unreachable: attributes only match inside a target call
  if (!target) {
    return started;
  }
  return {
    ...started,
    attrBaseline: {
      name: target.name,
      requirements: target.requirements,
      source: target.source,
    },
  };
}

/**
 * Discards everything the attribute contributed, because an expression around
 * its whole value chooses between values rather than building one:
 * `requirements=["a==1"] if x else ["b==2"]` holds one of those lists and
 * nothing says which. Reporting the first would update an arm that may not be
 * the one in use, leaving the live one stale.
 */
function discardAttribute(ctx: Ctx): Ctx {
  const { target, attrBaseline } = ctx;
  // v8 ignore next -- unreachable: only matched inside a target, after startAttr
  if (!target || !attrBaseline) {
    return ctx;
  }
  const restored: Ctx = {
    ...ctx,
    target: {
      ...target,
      requirements: attrBaseline.requirements,
      name: attrBaseline.name,
    },
    skipElement: true,
  };
  return ctx.attr === 'source' ? markSourceUnresolved(restored) : restored;
}

/**
 * Ends the element being read. For `requirements` the next literal starts a new
 * one. For `source`, which names a single file, a break means the value is an
 * expression rather than a path written in parts, so the field is unresolved:
 * `("a.txt" if x else "b.txt")` is not the path `a.txtb.txt`.
 */
function markComma(ctx: Ctx): Ctx {
  if (ctx.attr === 'source' && ctx.target?.source !== undefined) {
    return { ...markSourceUnresolved(ctx), afterComma: true };
  }
  return { ...ctx, afterComma: true, skipElement: false };
}

/**
 * Abandons the element being read: an operator such as `+` or `%` builds its
 * value from parts, so reporting the first part would name a package at a
 * version it is not pinned to.
 */
function discardElement(ctx: Ctx): Ctx {
  const { target } = ctx;
  if (ctx.attr === 'source') {
    return {
      ...markSourceUnresolved(ctx),
      afterComma: true,
      skipElement: true,
    };
  }
  // Only `requirements` accumulates a list a literal can be taken back out of.
  if (!target || ctx.attr !== 'requirements' || ctx.afterComma !== false) {
    return { ...ctx, afterComma: true, skipElement: true };
  }
  return {
    ...ctx,
    afterComma: true,
    skipElement: true,
    target: { ...target, requirements: target.requirements.slice(0, -1) },
  };
}

/**
 * Ends the element, or abandons it when what follows continues a literal rather
 * than standing on its own: `["a==1"[0:3]]` is not `a==1`, while
 * `[f(x), "a==1"]` holds a call and then a requirement.
 */
function endOrDiscardElement(ctx: Ctx): Ctx {
  if (ctx.afterComma === false) {
    return discardElement(ctx);
  }
  // Only a comma finishes an element, so an abandonment must survive until the
  // next one: in `["a==1" if x else "b==2"]`, `x` and `else` must not revive
  // the element, or the second arm becomes a requirement of its own.
  if (ctx.skipElement) {
    return { ...ctx, afterComma: true };
  }
  return markComma(ctx);
}

function markSourceUnresolved(ctx: Ctx): Ctx {
  const { target } = ctx;
  // v8 ignore next -- unreachable: only matched inside a target call
  if (!target) {
    return ctx;
  }
  // Drops any literal already read: in `"a" + b` the first operand is a string
  // but the whole value is not.
  return {
    ...ctx,
    target: { ...target, source: undefined, sourceUnresolved: true },
  };
}

/**
 * Appends a requirement, or joins it to the previous one when Python would:
 * `["foo" ">=1,<2"]` is one requirement, not two. The parts are kept because
 * only text that the file holds in one piece can be replaced in it.
 */
function appendRequirement(
  requirements: PantsRequirement[],
  value: string,
  afterComma: boolean,
): PantsRequirement[] {
  if (afterComma || !requirements.length) {
    return [...requirements, { value, parts: [value] }];
  }
  const last = requirements.at(-1)!;
  return [
    ...requirements.slice(0, -1),
    { value: last.value + value, parts: [...last.parts, value] },
  ];
}

function addString(ctx: Ctx, value: string): Ctx {
  const { target, attr } = ctx;
  if (ctx.skipElement) {
    // The element this literal belongs to is computed, so no part of it is a
    // value this manager can use.
    return ctx;
  }
  if (attr === 'source' && target?.sourceUnresolved) {
    // Already known to be an expression: no later literal in it is the path.
    return ctx;
  }
  // v8 ignore next -- unreachable: strings only match inside an attribute
  if (!target || !attr) {
    return ctx;
  }

  const afterComma = ctx.afterComma !== false;
  switch (attr) {
    case 'name':
      return { ...ctx, target: { ...target, name: value } };
    case 'source':
      return {
        ...ctx,
        afterComma: false,
        target: {
          ...target,
          source:
            afterComma || target.source === undefined
              ? value
              : target.source + value,
        },
      };
    case 'requirements':
      return {
        ...ctx,
        afterComma: false,
        target: {
          ...target,
          requirements: appendRequirement(
            target.requirements,
            value,
            afterComma,
          ),
        },
      };
    // v8 ignore next -- unreachable: attrNameRegex allows nothing else
    default:
      return ctx;
  }
}

/**
 * Reads one string literal, whether or not it interpolates.
 *
 * An interpolated literal abandons the element rather than ending it, because
 * the interpolation is part of the value wherever in the element it sits:
 * neither `["pkg==1.0" f"-{X}"]` nor `[f"{X}-" "pkg==1.0"]` pins the version it
 * appears to, and a `source` written that way names no file that can be read.
 */
function addStringLiteral(ctx: Ctx, node: parser.StringTree): Ctx {
  // `f"pkg=={{}}"` interpolates nothing, since `{{` is an escape, but the lexer
  // still gives it a template child, so it is abandoned rather than read as the
  // constant it is.
  if (node.children.some((child) => child.type === 'template-tree')) {
    return discardElement(ctx);
  }
  const value = node.children
    .filter(
      (child): child is lexer.StringValueToken => child.type === 'string-value',
    )
    .map((child) => child.value)
    .join('');
  return addString(ctx, value);
}

// Matches the literal itself, not the text inside it: `q.str(handler)` matches
// the `string-value` token one level down, which an interpolated literal does
// not have, so literals on either side of one would join across it.
const stringValue = q.str<Ctx>({ postHandler: addStringLiteral });

// Reads the inside of a list or tuple, where the comma is the only operator
// that can separate two elements. Every other operator builds a value out of
// parts, so no literal in such an element is the value:
// `["pkg=={}".format(v)]` is not a requirement on `pkg=={}`. Partitioning on
// the comma covers every builder without enumerating them.
//
// No alternative depends on being ordered before another: each matches a single
// token or a whole tree, so none can begin inside another's match.
const stringSequence = q.many(
  q.alt<Ctx>(
    stringValue,
    q.op<Ctx>(regEx(/^,$/), markComma),
    q.op<Ctx>(regEx(/^[^,]+$/), discardElement),
    // A name continuing a literal abandons the element, as an operator does.
    // `["a==1" if x else "b==2"]` holds a literal on each side of the
    // conditional, and both would be reported as the same package, so one
    // branch would bump both arms and leave a conditional with identical arms.
    // `[x if c else "a==1"]` has a single literal and is kept: there is nothing
    // to collapse.
    q.sym<Ctx>(endOrDiscardElement),
    q.num<Ctx>(endOrDiscardElement),
    // Nested structures are stepped over rather than read into: a call's
    // arguments are not requirements, and a parenthesised run of literals
    // cannot be told from them here.
    q.tree<Ctx>({
      type: 'wrapped-tree',
      maxDepth: 1,
      postHandler: endOrDiscardElement,
    }),
  ),
);

/** A list or a tuple of strings: Pants accepts either. */
const stringList = q.tree<Ctx>({
  type: 'wrapped-tree',
  maxDepth: 1,
  startsWith: '[',
  endsWith: ']',
  search: stringSequence,
});

const stringTuple = q.tree<Ctx>({
  type: 'wrapped-tree',
  maxDepth: 1,
  startsWith: '(',
  endsWith: ')',
  search: stringSequence,
});

/**
 * An attribute whose whole value an expression selects, as in
 * `requirements=["a==1"] if PY39 else ["b==2"]`.
 *
 * Only the selection keywords, which are names rather than operators.
 * Arithmetic around a list preserves membership -- `["a==1"] + extra` still
 * contains `a==1` -- so those are left to `attribute`, which reads them.
 */
const attributeSelectedByExpression = q
  .sym<Ctx>(attrNameRegex, (ctx, token) => startAttr(ctx, token.value))
  .op('=')
  .alt(q.many(stringValue, 1, 32), stringList, stringTuple)
  .sym(regEx(/^(?:if|else|or|and|not|in|is)$/), discardAttribute);

const attribute = q
  .sym<Ctx>(attrNameRegex, (ctx, token) => startAttr(ctx, token.value))
  .op('=')
  .alt(
    // `q.many` so adjacent literals join as they do inside a list:
    // `source="sub" "/reqs.txt"` names one path.
    //
    // This branch has no builder check, so `requirements="pkg=={}".format(v)`
    // would read as `pkg=={}`. Pants rejects a bare string for `requirements`,
    // so that cannot appear in a repository that builds; the branch serves
    // `name` and the `source` that `sourceContinuedByExpression` refused.
    q.many(stringValue, 1, 32),
    stringList,
    stringTuple,
  );

/**
 * A `source` whose value starts with a literal and then continues, as in
 * `"a" + b`, `"a.txt" if x else "b.txt"`, `"a" % env` or `"a-{}.txt".format(x)`.
 * Taking the first literal would name a file the target may not read, so the
 * whole value counts as unresolved.
 *
 * Rather than enumerate what can continue an expression, this matches anything
 * that is not the end of the value: any operator but the comma separating one
 * field from the next, any name, since `if`, `or` and `and` are symbols rather
 * than operators, and any structure, as in a subscript or method call.
 */
const sourceContinuedByExpression = q
  .sym<Ctx>('source', (ctx) => startAttr(ctx, 'source'))
  .op('=')
  .many(stringValue, 1, 32)
  .alt(
    q.op<Ctx>(regEx(/^[^,]+$/), markSourceUnresolved),
    q.sym<Ctx>(markSourceUnresolved),
    q.tree<Ctx>({
      type: 'wrapped-tree',
      maxDepth: 1,
      postHandler: markSourceUnresolved,
    }),
  );

/**
 * A `source` whose value is not a string at all, such as a variable. Recording
 * that the field was given is what keeps the default from being used for a file
 * the target does not name.
 */
const nonLiteralSource = q.sym<Ctx>('source').op('=', markSourceUnresolved);

const targetArgs = q.tree<Ctx>({
  type: 'wrapped-tree',
  maxDepth: 1,
  // A target is a call. Without this, `X = python_requirements[0]` would match
  // and become a target that then claims the default source.
  startsWith: '(',
  endsWith: ')',
  // Optional because every field has a default, so `python_requirements()` is
  // valid on its own.
  //
  // These alternatives all begin at the same token, where the first match wins,
  // so they run most specific first: the one needing a trailing selection
  // keyword, then the one needing an expression after a `source` literal, or
  // `source="a" + b` would read as `"a"`. `nonLiteralSource` matches on
  // `source=` alone, so it must come last or it consumes a literal before
  // `attribute` sees it.
  search: q.opt<Ctx>(
    q.alt<Ctx>(
      attributeSelectedByExpression,
      sourceContinuedByExpression,
      attribute,
      nonLiteralSource,
    ),
  ),
  postHandler: endTarget,
});

// One matcher per target type, so the type in the context is the literal that
// matched.
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

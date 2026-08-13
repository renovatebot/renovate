import { templatableFields } from './templatable-fields.generated.ts';

/**
 * Fields none of the shared lists cover: host rule credentials, and metadata read
 * by a single manager. These are where every injection found so far actually lived
 * -- `distributionUrl` (gradle-wrapper), `distributionType` (maven-wrapper),
 * `organization` and `token` (mix), `token` (nix) -- so they are worth carrying by
 * hand until there is a list to derive them from.
 */
const MANAGER_SPECIFIC_UNTRUSTED_NAMES = [
  'distributionType',
  'distributionUrl',
  'extraIndexUrl',
  'indexUrl',
  'lockFile',
  'lockFileName',
  'organization',
  'packageFileName',
  'password',
  'token',
  'username',
];

/**
 * Booleans, numbers and timestamps among the derived fields. They cannot carry
 * shell metacharacters, and flagging them is pure noise -- `newMajor` is a
 * `number`, and reporting `mod upgrade -t=${newMajor}` in manager/gomod is wrong.
 */
const NON_STRING_FIELD_RE =
  /^(?:is|has)[A-Z]|(?:Major|Minor|Patch|AgeInDays|Timestamp)$/;

/**
 * Fields that hold a value the repository controls, and that therefore should not
 * reach a shell unescaped.
 *
 * The bulk is taken from `templatableFields`, generated from the lists Renovate
 * already maintains (`validMatchFields`, `exposedConfigOptions`, `allowedFields`),
 * rather than restated here -- so a field added to any of them is covered without
 * touching this rule. It is read from the generated file because this runs inside
 * oxlint, which must not depend on `lib/`;
 * `test/other/validate-templatable-fields.spec.ts` keeps the two in step.
 */
const UNTRUSTED_NAMES = new Set(
  [...templatableFields, ...MANAGER_SPECIFIC_UNTRUSTED_NAMES].filter(
    (name) => !NON_STRING_FIELD_RE.test(name),
  ),
);

/**
 * shlex's escaping helpers. `quote` escapes one value; `join` escapes each element
 * of an array and joins them, so both produce shell-safe output.
 *
 * Only matched as a bare identifier (`quote(x)`) or off a namespace import
 * (`shlex.quote(x)`) -- deliberately not as an arbitrary `.quote()`/`.join()`
 * method, because `Array.prototype.join` shares the name and escapes nothing.
 */
const SHLEX_HELPERS = new Set(['quote', 'join']);

/** Chain methods that pass a built string through without making it a command. */
const ARRAY_METHODS = new Set(['map', 'filter', 'flatMap', 'flat', 'concat']);

/**
 * Variables/properties that hold a command being assembled. Used to decide
 * whether a template literal is command-shaped, so that log messages and regexes
 * interpolating the same values are left alone.
 */
const COMMAND_NAME_RE = /(?:^|[a-z])(?:cmd|command|args)/i;

/**
 * @param {any} node
 */
function unwrap(node) {
  let current = node;
  while (
    current?.type === 'ChainExpression' ||
    current?.type === 'TSNonNullExpression' ||
    current?.type === 'TSAsExpression'
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * The name an interpolated expression reads, or null when it isn't a plain
 * identifier or property access (a call, a ternary, a literal, ...).
 *
 * @param {any} input
 */
function readName(input) {
  const node = unwrap(input);
  if (node?.type === 'Identifier') {
    return node.name;
  }
  if (
    node?.type === 'MemberExpression' &&
    node.property?.type === 'Identifier'
  ) {
    return node.property.name;
  }
  return null;
}

/**
 * Whether this expression mentions shlex's `quote` anywhere within it, which is
 * what makes `deps.map(quote).join(' ')` safe while `deps.join(' ')` is not.
 *
 * @param {any} node
 * @returns {boolean}
 */
function mentionsQuote(node) {
  if (!node || typeof node !== 'object') {
    return false;
  }
  if (node.type === 'Identifier' && node.name === 'quote') {
    return true;
  }
  if (
    node.type === 'MemberExpression' &&
    node.property?.type === 'Identifier' &&
    node.property.name === 'quote'
  ) {
    return true;
  }
  for (const key of ['callee', 'object', 'arguments', 'body', 'expression']) {
    const child = node[key];
    if (Array.isArray(child)) {
      if (child.some(mentionsQuote)) {
        return true;
      }
    } else if (mentionsQuote(child)) {
      return true;
    }
  }
  return false;
}

/**
 * True when the interpolated expression has been escaped: a `quote()` /
 * `shlex.quote()` / shlex `join()` call, or an array chain that maps `quote` over
 * its elements before joining.
 *
 * A bare `x.join(...)` is NOT accepted -- `Array.prototype.join` escapes nothing,
 * and every safe site in the repo spells it `.map(quote).join(...)`.
 *
 * @param {any} input
 */
function isQuoted(input) {
  const node = unwrap(input);
  if (node?.type !== 'CallExpression') {
    return false;
  }
  const callee = unwrap(node.callee);

  // `quote(x)` / `join(xs)` imported from shlex
  if (callee?.type === 'Identifier' && SHLEX_HELPERS.has(callee.name)) {
    return true;
  }

  if (
    callee?.type === 'MemberExpression' &&
    callee.property?.type === 'Identifier'
  ) {
    // `shlex.quote(x)` / `shlex.join(xs)` off a namespace import
    if (
      SHLEX_HELPERS.has(callee.property.name) &&
      readName(callee.object) === 'shlex'
    ) {
      return true;
    }
    // `xs.map(quote).join(' ')` -- the escaping is in the receiver chain
    if (callee.property.name === 'join') {
      return mentionsQuote(callee.object);
    }
  }

  return false;
}

/**
 * The untrusted names an interpolated expression reads, looking through calls that
 * neither escape nor launder their input, so `String(depName)` and `token.trim()`
 * are seen the same way a bare `depName` is. Deliberately shallow: it inspects a
 * call's own arguments and receiver, not arbitrary nesting.
 *
 * @param {any} input
 * @returns {string[]}
 */
function readUntrustedNames(input) {
  const node = unwrap(input);
  const direct = readName(node);
  if (direct !== null) {
    return UNTRUSTED_NAMES.has(direct) ? [direct] : [];
  }
  if (node?.type !== 'CallExpression') {
    return [];
  }
  const callee = unwrap(node.callee);
  const candidates = [...node.arguments];
  if (callee?.type === 'MemberExpression') {
    candidates.push(callee.object);
  }
  const found = candidates
    .map((candidate) => readName(candidate))
    .filter((name) => name !== null && UNTRUSTED_NAMES.has(name));
  return [...new Set(found)];
}

/**
 * Whether this template literal is being used to build a command, rather than a
 * log line or a regex. Matches the shapes the managers actually use: an argument
 * to `exec()`, the value of a `cmd`/`command`/`args` binding, or something pushed
 * onto a `commands` array.
 *
 * @param {any} node
 * @param {any} parent
 * @returns {boolean}
 */
function isCommandContext(node, parent) {
  if (!parent) {
    return false;
  }
  switch (parent.type) {
    case 'CallExpression': {
      const callee = unwrap(parent.callee);
      if (callee?.type === 'Identifier' && callee.name === 'exec') {
        return true;
      }
      if (callee?.type === 'MemberExpression') {
        // `commands.push(...)`, `cmds.unshift(...)`
        if (COMMAND_NAME_RE.test(readName(callee.object) ?? '')) {
          return true;
        }
        // `deps.map(dep => `cmd ${dep.depName}`).join(' ')` — the mapped strings
        // are commands only if what the chain ends up in is one, so keep walking.
        if (ARRAY_METHODS.has(readName(callee) ?? '')) {
          return isCommandContext(parent, parent.parent);
        }
      }
      return false;
    }
    case 'VariableDeclarator':
      return COMMAND_NAME_RE.test(readName(parent.id) ?? '');
    case 'AssignmentExpression':
      return COMMAND_NAME_RE.test(readName(parent.left) ?? '');
    case 'ArrowFunctionExpression':
      // implicit return: `dep => `cmd ${dep.depName}``
      return parent.body === node
        ? isCommandContext(parent, parent.parent)
        : false;
    case 'ReturnStatement':
    case 'ArrayExpression':
    case 'TemplateLiteral':
    case 'ConditionalExpression':
    case 'LogicalExpression':
      // `return `...``, `[`...`]`, nested templates, `x ? `...` : y`
      return isCommandContext(parent, parent.parent);
    default:
      return false;
  }
}

/**
 * Flags repo-controlled values interpolated into a command string without being
 * escaped with `quote()` from `shlex`.
 *
 * Under `binarySource=docker` (and anywhere `ExecOptions.shell` is set) the
 * assembled string is evaluated by a real shell, so an unescaped `$(...)`, `;` or
 * backtick in a dependency name, path or token becomes command execution.
 *
 * Prefer passing `CommandWithOptions.command` as a `string[]`, which is escaped
 * centrally; otherwise wrap each interpolated value in `quote()`.
 *
 * Accepts `quote()`, `shlex.quote()`, shlex's `join()`, and `.map(quote).join()`.
 * A bare `xs.join()` is not accepted, since `Array.prototype.join` escapes
 * nothing. Calls that neither escape nor launder their input are looked through,
 * so `String(depName)` and `token.trim()` read the same as a bare `depName`.
 *
 * Known blind spots, both from being a purely syntactic, local check:
 *
 * - It matches on the *name* interpolated, so an untrusted value copied into a
 *   differently-named local is not seen. `const type = distributionType ??
 *   'script'` (maven-wrapper) and the derived `importHosts` list (deno) were both
 *   real injections this would have missed.
 * - An unescaped `join()` is only reported when the receiver is an inline
 *   expression, because a bare identifier may have had its elements escaped as
 *   they were added -- which is how manager/helmv3 builds its `parameters` array,
 *   and is not knowable without resolving the variable.
 *
 * It is a backstop for the common shape, not a substitute for review.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    messages: {
      noUnquotedExecInterpolation:
        "`{{name}}` is repository-controlled, so interpolating it into a command unescaped allows shell injection. Wrap it in `quote()` from 'shlex', or pass the command as a `string[]` via `CommandWithOptions`.",
      noUnquotedJoin:
        "`Array.prototype.join` escapes nothing, so joining these values into a command allows shell injection if any of them is repository-controlled. Use `.map(quote).join(...)` with `quote()` from 'shlex', or `join()` from 'shlex', or pass the command as a `string[]` via `CommandWithOptions`.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.physicalFilename ?? '';
    if (!filename.includes('/lib/') || filename.endsWith('.spec.ts')) {
      return {};
    }
    return {
      TemplateLiteral(node) {
        if (!isCommandContext(node, /** @type {any} */ (node).parent)) {
          return;
        }
        for (const expression of node.expressions) {
          if (isQuoted(expression)) {
            continue;
          }

          const inner = unwrap(expression);
          const callee =
            inner?.type === 'CallExpression' ? unwrap(inner.callee) : null;

          if (
            callee?.type === 'MemberExpression' &&
            callee.property?.type === 'Identifier' &&
            callee.property.name === 'join'
          ) {
            // Reachable only when nothing in the chain escaped anything. Report
            // just the inline forms -- `deps.map((d) => d.depName).join(' ')` --
            // where that is locally visible. A bare identifier is skipped
            // because its elements may already have been escaped as they were
            // added, which is not knowable syntactically; manager/helmv3 builds
            // its `parameters` array exactly that way.
            if (unwrap(callee.object)?.type !== 'Identifier') {
              context.report({ node: expression, messageId: 'noUnquotedJoin' });
            }
            continue;
          }

          // Otherwise look at the value being read -- directly, or through a
          // call that neither escapes nor launders it (`String(depName)`,
          // `token.trim()`), so wrapping an untrusted value doesn't hide it.
          for (const name of readUntrustedNames(inner)) {
            context.report({
              node: expression,
              messageId: 'noUnquotedExecInterpolation',
              data: { name },
            });
          }
        }
      },
    };
  },
};

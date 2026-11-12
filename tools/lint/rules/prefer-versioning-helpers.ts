import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

const groupOpen = String.raw`(?:\((?:\?:|\?<\w+>)?)*`;
const digit = String.raw`(?:\\d|\[0-9\])(?:[+*?]|\{\d+(?:,\d*)?\})?`;

/**
 * Matches the source of a regex which starts with a dotted number, optionally
 * `v`-prefixed, e.g. `^\d+\.\d+\.\d+$`, `^v?\d+(?:\.\d+)?$` or
 * `^(?<major>\d+)\.(?<minor>\d+)`.
 */
const versionPatternRegex = new RegExp(
  String.raw`^\^${groupOpen}(?:v|\[vV\])?\??${groupOpen}${digit}\)*${groupOpen}\\\.${groupOpen}${digit}`,
);

function isVersionPattern(pattern: string, flags: string): boolean {
  // with the `m` flag, `^` anchors a line of a file, not a version string
  return !flags.includes('m') && versionPatternRegex.test(pattern);
}

function stringValue(node: ESTree.Node | undefined): string | null {
  if (node?.type !== 'Literal' || typeof node.value !== 'string') {
    return null;
  }
  return node.value;
}

/**
 * Flags regexes which parse or validate a whole version string, such as
 * `/^\d+\.\d+\.\d+$/` or `/^v?\d+(?:\.\d+)?$/`. The versionings in
 * `lib/modules/versioning` own what counts as a valid, stable or partial
 * version, so callers use their API instead of a parallel definition.
 *
 * Only regexes anchored at the start of the string with a leading dotted number
 * are reported. Regexes extracting a version from surrounding text (a prefix
 * like `^go\s*` or the `m` flag) are left alone.
 */
export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      preferVersioningHelpers:
        'Do not parse or validate versions with a regex. Use the versioning API from `lib/modules/versioning` instead, e.g. `get(id).isVersion()`, `isStable()` or `getMajor()`, and add a predicate to the matching versioning if none fits.',
    },
  },
  createOnce(context) {
    return {
      Literal(node) {
        if (
          'regex' in node &&
          isVersionPattern(node.regex.pattern, node.regex.flags)
        ) {
          context.report({ node, messageId: 'preferVersioningHelpers' });
        }
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'regEx') {
          return;
        }
        const [patternArg, flagsArg] = node.arguments;
        const pattern = stringValue(patternArg);
        const flags = stringValue(flagsArg) ?? '';
        if (pattern !== null && isVersionPattern(pattern, flags)) {
          context.report({ node, messageId: 'preferVersioningHelpers' });
        }
      },
    };
  },
});

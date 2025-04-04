import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';

// Taken from https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string. Licensed under CC BY 3.0
// Removed the ^ and $.
// Made minor and patch versions optional by surrounding them in parentheses followed by a question mark.
const semverRegex =
  /(0|[1-9]\d*)(\.(0|[1-9]\d*))?(\.(0|[1-9]\d*))?(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?/;

/**
 * This can convert most hashicorp ranges to valid npm syntax
 * The `!=` syntax is currently unsupported as there is no direct
 * equivalent in npm and isn't widely used
 * The version part of the constraint is parsed as a semver but with the minor and patch versions being optional.
 * The prerelease syntax is less well-defined for hashicorp and will
 * cause issues if it is not semvar compatible as no attempts to convert it
 * are made
 */
export function hashicorp2npm(input: string): string {
  if (!input) {
    return input;
  }
  return input
    .split(',')
    .map((single) => {
      const r = single.match(
        regEx(
          `^\\s*(?<operator>(|=|!=|>|<|>=|<=|~>))\\s*v?(?<version>${semverRegex.source})\\s*$`,
        ),
      );
      if (!r) {
        logger.warn(
          { constraint: input, element: single },
          'Invalid hashicorp constraint',
        );
        throw new Error('Invalid hashicorp constraint');
      }
      if (r.groups!.operator === '!=') {
        logger.warn(
          { constraint: input, element: single },
          'Unsupported hashicorp constraint',
        );
        throw new Error('Unsupported hashicorp constraint');
      }
      return {
        operator: r.groups!.operator,
        version: r.groups!.version,
      };
    })
    .map(({ operator, version }) => {
      switch (operator) {
        case '=':
          return version;
        case '~>':
          if (version.match(regEx(/^\d+$/))) {
            return `>=${version}`;
          }
          if (version.match(regEx(/^\d+\.\d+$/))) {
            return `^${version}`;
          }
          return `~${version}`;
        default:
          return `${operator}${version}`;
      }
    })
    .join(' ');
}

/**
 * This can convert a limited set of npm range syntax to hashicorp,
 * it supports all the syntax that hashicorp2npm can output
 * It cannot handle `*`, `1.x.x`, range with `-`, `||`
 */
export function npm2hashicorp(input: string): string {
  if (!input) {
    return input;
  }
  return input
    .split(' ')
    .map((single) => {
      const r = single.match(
        regEx(
          `^(?<operator>(|>|<|>=|<=|~|\\^))v?(?<version>${semverRegex.source})$`,
        ),
      );
      if (!r) {
        throw new Error('invalid npm constraint');
      }
      return {
        operator: r.groups!.operator,
        version: r.groups!.version,
      };
    })
    .map(({ operator, version }) => {
      switch (operator) {
        case '^': {
          if (version.match(regEx(/^\d+$/))) {
            return `~> ${version}.0`;
          }
          const withZero = version.match(regEx(/^(\d+\.\d+)\.0$/));
          if (withZero) {
            return `~> ${withZero[1]}`;
          }
          const nonZero = version.match(regEx(/^(\d+\.\d+)\.\d+$/));
          if (nonZero) {
            // not including`>= ${version}`, which makes this less accurate
            // but makes the results cleaner
            return `~> ${nonZero[1]}`;
          }
          return `~> ${version}`;
        }
        case '~':
          if (version.match(regEx(/^\d+$/))) {
            return `~> ${version}.0`;
          }
          if (version.match(regEx(/^\d+\.\d+$/))) {
            return `~> ${version}.0`;
          }
          return `~> ${version}`;
        case '':
          return `${version}`;
        default:
          return `${operator} ${version}`;
      }
    })
    .join(', ');
}

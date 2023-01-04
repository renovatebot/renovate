import { regEx } from '../../../util/regex';

/**
 * This can convert most hashicorp ranges to valid npm syntax
 * The `!=` syntax is currently unsupported as there is no direct
 * equivalent in npm and isn't widely used
 * Also prerelease syntax is less well-defined for hashicorp and will
 * cause issues if it is not semvar compatible as no attempts to convert it
 * are made
 */
export function hashicorp2npm(input: string): string {
  return input
    .split(',')
    .map((single) => {
      const r = single.match(
        regEx(/^\s*(|=|!=|>|<|>=|<=|~>)\s*v?((\d+)(\.\d+){0,2}[\w-+]*)\s*$/)
      );
      if (!r) {
        throw new Error('invalid hashicorp constraint');
      }
      if (r[1] === '!=') {
        throw new Error('unsupported != in hashicorp constraint');
      }
      return {
        operator: r[1],
        version: r[2],
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
  return input
    .split(' ')
    .map((single) => {
      const r = single.match(
        regEx(/^(|>|<|>=|<=|~|\^)((\d+)(\.\d+){0,2}[\w-]*)$/)
      );
      if (!r) {
        throw new Error('invalid npm constraint');
      }
      return {
        operator: r[1],
        version: r[2],
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
            return `~> ${nonZero[1]}, >= ${version}`;
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

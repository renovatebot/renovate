import { logger } from '../../../logger';
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
  if (!input) {
    return input;
  }
  return input
    .split(',')
    .map((single) => {
      const r = regEx(
        /^\s*(|=|!=|>|<|>=|<=|~>)\s*v?((\d+)(\.\d+){0,2}[\w-+]*(\.\d+)*)\s*$/,
      ).exec(single);
      if (!r) {
        logger.warn(
          { constraint: input, element: single },
          'Invalid hashicorp constraint',
        );
        throw new Error('Invalid hashicorp constraint');
      }
      if (r[1] === '!=') {
        logger.warn(
          { constraint: input, element: single },
          'Unsupported hashicorp constraint',
        );
        throw new Error('Unsupported hashicorp constraint');
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
          if (regEx(/^\d+$/).test(version)) {
            return `>=${version}`;
          }
          if (regEx(/^\d+\.\d+$/).test(version)) {
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
      const r = regEx(
        /^(|>|<|>=|<=|~|\^)v?((\d+)(\.\d+){0,2}[\w-]*(\.\d+)*)$/,
      ).exec(single);
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
          if (regEx(/^\d+$/).test(version)) {
            return `~> ${version}.0`;
          }
          const withZero = regEx(/^(\d+\.\d+)\.0$/).exec(version);
          if (withZero) {
            return `~> ${withZero[1]}`;
          }
          const nonZero = regEx(/^(\d+\.\d+)\.\d+$/).exec(version);
          if (nonZero) {
            // not including`>= ${version}`, which makes this less accurate
            // but makes the results cleaner
            return `~> ${nonZero[1]}`;
          }
          return `~> ${version}`;
        }
        case '~':
          if (regEx(/^\d+$/).test(version)) {
            return `~> ${version}.0`;
          }
          if (regEx(/^\d+\.\d+$/).test(version)) {
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

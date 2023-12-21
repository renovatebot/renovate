import { regEx } from '../../../util/regex';

/**
 * regex used by poetry.core.version.Version to parse union of SemVer
 * (with a subset of pre/post/dev tags) and PEP440
 * see: https://github.com/python-poetry/poetry-core/blob/01c0472d9cef3e1a4958364122dd10358a9bd719/poetry/core/version/version.py
 */

// prettier-ignore
export const VERSION_PATTERN = regEx(
    [
      '^',
      'v?',
      '(?:',
        '(?:(?<epoch>[0-9]+)!)?',           // epoch
        '(?<release>[0-9]+(?:\\.[0-9]+){0,2})', // release segment
        '(?<pre>',                          // pre-release
          '[-_.]?',
          '(?<pre_l>(a|b|c|rc|alpha|beta|pre|preview))',
          '[-_.]?',
          '(?<pre_n>[0-9]+)?',
        ')?',
        '(?<post>',                         // post release
          '(?:-(?<post_n1>[0-9]+))',
          '|',
          '(?:',
            '[-_.]?',
            '(?<post_l>post|rev|r)',
            '[-_.]?',
            '(?<post_n2>[0-9]+)?',
          ')',
        ')?',
        '(?<dev>',                          // dev release
          '[-_.]?',
          '(?<dev_l>dev)',
          '[-_.]?',
          '(?<dev_n>[0-9]+)?',
        ')?',
      ')',
      '(?:\\+(?<local>[a-z0-9]+(?:[-_.][a-z0-9]+)*))?', // local version
      '$'
    ].join('')
  );

export const RANGE_COMPARATOR_PATTERN = regEx(
  /(\s*(?:\^|~|[><!]?=|[><]|\|\|)\s*)/,
);

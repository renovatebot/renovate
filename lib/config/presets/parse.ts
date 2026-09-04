import { isNonEmptyString, isString } from '@sindresorhus/is';
import { regEx } from '../../util/regex.ts';
import { isHttpUrl } from '../../util/url.ts';
import type { ParsedPreset } from './types.ts';
import { PRESET_INVALID, PRESET_PROHIBITED_SUBPRESET } from './util.ts';

const nonScopedPresetWithSubdirRegex = regEx(
  /^(?<repo>~?[\w\-. /%]+?)\/\/(?:(?<presetPath>[\w\-./]+)\/)?(?<presetName>[\w\-.]+)(?:#(?<tag>[\w\-./]+?))?$/,
);
const gitPresetRegex = regEx(
  /^(?<repo>~?[\w\-. /%]+)(?::(?<presetName>[\w\-.+/]+))?(?:#(?<tag>[\w\-./]+?))?$/,
);
const relativePresetRegex = regEx(
  /^(?:\/|(?:\.\.?\/)+)[\w\-.]+(?:\/[\w\-.]+)*$/,
);

/**
 * Returns true if the given `extends` entry is a relative preset reference,
 * e.g. `./foo`, `../foo` or `/foo`.
 */
export function isRelativePresetReference(input: string): boolean {
  return (
    input.startsWith('./') || input.startsWith('../') || input.startsWith('/')
  );
}

/**
 * Splits the trailing `(...)` parameter list off the given preset reference.
 *
 * The parameters are opaque, so they may contain any character and are split
 * off before the reference itself is validated.
 */
function splitPresetParams(input: string): {
  str: string;
  params: string[] | undefined;
  rawParams: string | undefined;
} {
  if (!input.includes('(')) {
    return { str: input, params: undefined, rawParams: undefined };
  }

  const rawParams = input.slice(input.indexOf('(') + 1, -1);
  return {
    str: input.slice(0, input.indexOf('(')),
    params: rawParams.split(',').map((elem) => elem.trim()),
    rawParams,
  };
}

/**
 * Returns true if every parenthesis in the given preset parameters is closed in
 * order, which allows Handlebars sub-expressions like `{{ lower (env.TEAM) }}`
 * while still rejecting malformed parameter lists.
 */
function hasBalancedParens(rawParams: string): boolean {
  let depth = 0;
  for (const char of rawParams) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }
  return depth === 0;
}

export function parsePreset(input: string): ParsedPreset {
  let str = input;
  let presetSource: string | undefined;
  let presetPath: string | undefined;
  let repo: string;
  let presetName: string;
  let tag: string | undefined;
  let rawParams: string | undefined;
  let params: string[] | undefined;
  if (str.startsWith('github>')) {
    presetSource = 'github';
    str = str.substring('github>'.length);
  } else if (str.startsWith('gitlab>')) {
    presetSource = 'gitlab';
    str = str.substring('gitlab>'.length);
  } else if (str.startsWith('gitea>')) {
    presetSource = 'gitea';
    str = str.substring('gitea>'.length);
  } else if (str.startsWith('forgejo>')) {
    presetSource = 'forgejo';
    str = str.substring('forgejo>'.length);
  } else if (str.startsWith('local>')) {
    presetSource = 'local';
    str = str.substring('local>'.length);
  } else if (str.startsWith('npm>@')) {
    // only scoped packages are unambiguous, all other `npm>` references are
    // handled by the legacy strip below to stay backwards compatible
    presetSource = 'npm';
    str = str.substring('npm>'.length);
  } else if (isRelativePresetReference(str)) {
    presetSource = 'relative';
  } else if (isHttpUrl(str)) {
    presetSource = 'http';
  } else if (
    !str.startsWith('@') &&
    !str.startsWith(':') &&
    str.includes('/')
  ) {
    presetSource = 'local';
  }
  str = str.replace(regEx(/^npm>/), '');
  if (
    presetSource &&
    presetSource !== 'relative' &&
    isRelativePresetReference(str)
  ) {
    // relative references must not carry a source prefix, because they always
    // inherit the source of the preset which references them
    throw new Error(PRESET_INVALID);
  }
  presetSource = presetSource ?? 'npm';
  if (presetSource === 'relative') {
    if (str.includes('(') && !str.endsWith(')')) {
      throw new Error(PRESET_INVALID);
    }
    ({ str, params, rawParams } = splitPresetParams(str));
    if (isString(rawParams) && !hasBalancedParens(rawParams)) {
      throw new Error(PRESET_INVALID);
    }
    if (!relativePresetRegex.test(str)) {
      throw new Error(PRESET_INVALID);
    }
    const finalSegment = str.split('/').pop();
    if (finalSegment === '.' || finalSegment === '..') {
      // references like `./.`, `./..` or `../a/..` name a directory instead of
      // a preset file
      throw new Error(PRESET_INVALID);
    }
    return { presetSource, repo: '', presetName: str, params, rawParams };
  }
  ({ str, params, rawParams } = splitPresetParams(str));
  if (presetSource === 'http') {
    return { presetSource, repo: str, presetName: '', params, rawParams };
  }
  const presetsPackages = [
    'abandonments',
    'compatibility',
    'config',
    'customManagers',
    'default',
    'docker',
    'global',
    'group',
    'helpers',
    'mergeConfidence',
    'monorepo',
    'npm',
    'packages',
    'preview',
    'replacements',
    'schedule',
    'security',
    'workarounds',
  ];
  if (
    presetsPackages.some((presetPackage) => str.startsWith(`${presetPackage}:`))
  ) {
    presetSource = 'internal';
    [repo, presetName] = str.split(':');
  } else if (str.startsWith(':')) {
    // default namespace
    presetSource = 'internal';
    repo = 'default';
    presetName = str.slice(1);
  } else if (str.startsWith('@')) {
    // scoped namespace
    repo = regEx(/(?<scope>@.*?)(?::|$)/).exec(str)!.groups!.scope;
    str = str.slice(repo.length);
    if (!repo.includes('/')) {
      repo += '/renovate-config';
    }
    if (str === '') {
      presetName = 'default';
    } else {
      presetName = str.slice(1);
    }
  } else if (str.includes('//')) {
    // non-scoped namespace with a subdirectory preset

    // Validation
    if (str.includes(':')) {
      throw new Error(PRESET_PROHIBITED_SUBPRESET);
    }
    if (!nonScopedPresetWithSubdirRegex.test(str)) {
      throw new Error(PRESET_INVALID);
    }
    ({ repo, presetPath, presetName, tag } =
      nonScopedPresetWithSubdirRegex.exec(str)!.groups!);
  } else {
    ({ repo, presetName, tag } = gitPresetRegex.exec(str)!.groups!);

    if (presetSource === 'npm' && !repo.startsWith('renovate-config-')) {
      repo = `renovate-config-${repo}`;
    }
    if (!isNonEmptyString(presetName)) {
      presetName = 'default';
    }
  }

  return {
    presetSource,
    presetPath,
    repo,
    presetName,
    tag,
    params,
    rawParams,
  };
}

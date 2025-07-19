import is from '@sindresorhus/is';
import { regEx } from '../../util/regex';
import { isHttpUrl } from '../../util/url';
import type { ParsedPreset } from './types';
import { PRESET_INVALID, PRESET_PROHIBITED_SUBPRESET } from './util';

const nonScopedPresetWithSubdirRegex = regEx(
  /^(?<repo>~?[\w\-. /%]+?)\/\/(?:(?<presetPath>[\w\-./]+)\/)?(?<presetName>[\w\-.]+)(?:#(?<tag>[\w\-./]+?))?$/,
);
const gitPresetRegex = regEx(
  /^(?<repo>~?[\w\-. /%]+)(?::(?<presetName>[\w\-.+/]+))?(?:#(?<tag>[\w\-./]+?))?$/,
);

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
  presetSource = presetSource ?? 'npm';
  if (str.includes('(')) {
    rawParams = str.slice(str.indexOf('(') + 1, -1);
    params = rawParams.split(',').map((elem) => elem.trim());
    str = str.slice(0, str.indexOf('('));
  }
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
    [, repo] = regEx(/(@.*?)(:|$)/).exec(str)!;
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
    if (!is.nonEmptyString(presetName)) {
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

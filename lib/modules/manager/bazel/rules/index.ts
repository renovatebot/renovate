import { z } from 'zod/v4';
import { regEx } from '../../../../util/regex.ts';
import type { PackageDependency } from '../../types.ts';
import type { Fragment, FragmentData, Target } from '../types.ts';
import { dockerRules, DockerTarget } from './docker.ts';
import { gitRules, GitTarget } from './git.ts';
import { goRules, GoTarget } from './go.ts';
import { httpRules, HttpTarget } from './http.ts';
import { mavenRules, MavenTarget } from './maven.ts';
import { ociRules, OciTarget } from './oci.ts';

const Target = z.union([
  DockerTarget,
  OciTarget,
  GitTarget,
  GoTarget,
  HttpTarget,
  MavenTarget,
]);

/**
 * Gather all rule names supported by Renovate in order to speed up parsing
 * by filtering out other syntactically correct rules we don't support yet.
 */
const supportedRules = [
  ...dockerRules,
  ...ociRules,
  ...gitRules,
  ...goRules,
  ...httpRules,
  ...mavenRules,
];
export const supportedRulesRegex = regEx(`^(?:${supportedRules.join('|')})$`);

export function extractDepsFromFragmentData(
  fragmentData: FragmentData,
): PackageDependency[] {
  const res = Target.safeParse(fragmentData);
  if (!res.success) {
    return [];
  }
  return res.data;
}

export function extractDepsFromFragment(
  fragment: Fragment,
): PackageDependency[] {
  const fragmentData = extract(fragment);
  return extractDepsFromFragmentData(fragmentData);
}

export function extract(fragment: Fragment): FragmentData {
  if (fragment.type === 'string') {
    return fragment.value;
  }

  if (fragment.type === 'record') {
    const { children } = fragment;
    const result: Record<string, FragmentData> = {};
    for (const [key, value] of Object.entries(children)) {
      result[key] = extract(value);
    }
    return result;
  }

  return fragment.children.map(extract);
}

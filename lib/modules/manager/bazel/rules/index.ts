import { z } from 'zod';
import { regEx } from '../../../../util/regex';
import type { PackageDependency } from '../../types';
import { extract } from '../parser';
import type { Fragment, FragmentData, Target } from '../types';
import { DockerTarget, dockerRules } from './docker';
import { GitTarget, gitRules } from './git';
import { GoTarget, goRules } from './go';
import { HttpTarget, httpRules } from './http';

const Target = z.union([DockerTarget, GitTarget, GoTarget, HttpTarget]);

/**
 * Gather all rule names supported by Renovate in order to speed up parsing
 * by filtering out other syntactically correct rules we don't support yet.
 */
const supportedRules = [...dockerRules, ...gitRules, ...goRules, ...httpRules];
export const supportedRulesRegex = regEx(`^${supportedRules.join('|')}$`);

export function extractDepFromFragmentData(
  fragmentData: FragmentData
): PackageDependency | null {
  const res = Target.safeParse(fragmentData);
  if (!res.success) {
    return null;
  }
  return res.data;
}

export function extractDepFromFragment(
  fragment: Fragment
): PackageDependency | null {
  const fragmentData = extract(fragment);
  return extractDepFromFragmentData(fragmentData);
}

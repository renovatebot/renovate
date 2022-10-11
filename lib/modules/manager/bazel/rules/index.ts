import { ZodEffects, ZodObject, z } from 'zod';
import { regEx } from '../../../../util/regex';
import type { PackageDependency } from '../../types';
import { extract } from '../parser';
import type { Fragment, FragmentData, Target } from '../types';
import { DockerTarget } from './docker';
import { GitTarget } from './git';
import { GoTarget } from './go';
import { HttpTarget } from './http';

const Target = z.union([DockerTarget, GitTarget, GoTarget, HttpTarget]);

/**
 * Infer all rule names supported by Renovate in order to speed up parsing
 * by filtering out other syntactically correct rules we don't support yet.
 */
const supportedRules = Target.options.reduce<string[]>((res, targetSchema) => {
  const schema = targetSchema._def.schema;
  return schema instanceof ZodObject
    ? [...res, ...schema.shape.rule.options]
    : [...res, ...schema._def.schema.shape.rule.options];
}, []);

/**
 * Used by parser
 */
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

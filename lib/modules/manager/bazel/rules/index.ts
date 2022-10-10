import is from '@sindresorhus/is';
import { logger } from '../../../../logger';
import { regEx } from '../../../../util/regex';
import type { PackageDependency } from '../../types';
import type {
  Fragment,
  StringFragment,
  Target,
  TargetAttribute,
} from '../types';
import { dockerDependency } from './docker';
import { gitDependency } from './git';
import { goDependency } from './go';
import { httpDependency } from './http';

type DependencyExtractor = (_: Target) => PackageDependency | null;
type DependencyExtractorRegistry = Record<string, DependencyExtractor>;

const dependencyExtractorRegistry: DependencyExtractorRegistry = {
  git_repository: gitDependency,
  go_repository: goDependency,
  http_archive: httpDependency,
  http_file: httpDependency,
  container_pull: dockerDependency,
};

const supportedRules = Object.keys(dependencyExtractorRegistry);
export const supportedRulesRegex = regEx(`^${supportedRules.join('|')}$`);

function isTarget(x: Record<string, TargetAttribute>): x is Target {
  return is.string(x.name) && is.string(x.rule);
}

export function coerceFragmentToTarget(fragment: Fragment): Target | null {
  if (fragment.type === 'record') {
    const { children } = fragment;
    const target: Record<string, TargetAttribute> = {};
    for (const [key, value] of Object.entries(children)) {
      if (value.type === 'array') {
        const values = value.children
          .filter((x): x is StringFragment => x.type === 'string')
          .map((x) => x.value);
        target[key] = values;
      } else if (value.type === 'string') {
        target[key] = value.value;
      }
    }

    if (isTarget(target)) {
      return target;
    }
  }

  return null;
}

export function extractDepFromFragment(
  fragment: Fragment
): PackageDependency | null {
  const target = coerceFragmentToTarget(fragment);
  if (!target) {
    return null;
  }

  const dependencyExtractor = dependencyExtractorRegistry[target.rule];
  if (!dependencyExtractor) {
    logger.debug(
      `Bazel dependency extractor function not found for ${target.rule}`
    );
    return null;
  }

  return dependencyExtractor(target);
}

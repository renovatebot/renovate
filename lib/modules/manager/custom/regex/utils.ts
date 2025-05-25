import { URL } from 'node:url';
import is from '@sindresorhus/is';
import { migrateDatasource } from '../../../../config/migrations/custom/datasource-migration';
import { logger } from '../../../../logger';
import * as template from '../../../../util/template';
import type { PackageDependency } from '../../types';
import type { ValidMatchFields } from '../utils';
import { validMatchFields } from '../utils';
import type {
  ExtractionTemplate,
  RegexManagerConfig,
  RegexManagerTemplates,
} from './types';

function updateDependency(
  dependency: PackageDependency,
  field: ValidMatchFields,
  value: string,
): void {
  switch (field) {
    case 'registryUrl':
      // check if URL is valid and pack inside an array
      try {
        const url = new URL(value).toString();
        dependency.registryUrls = [url];
      } catch {
        logger.warn({ value }, 'Invalid regex manager registryUrl');
      }
      break;
    case 'datasource':
      dependency.datasource = migrateDatasource(value);
      break;
    case 'indentation':
      dependency.indentation = is.emptyStringOrWhitespace(value) ? value : '';
      break;
    default:
      dependency[field] = value;
      break;
  }
}

export function createDependency(
  extractionTemplate: ExtractionTemplate,
  config: RegexManagerConfig,
  dep?: PackageDependency,
): PackageDependency | null {
  const dependency = dep ?? {};
  const { groups, replaceString } = extractionTemplate;

  for (const field of validMatchFields) {
    const fieldTemplate = `${field}Template` as keyof RegexManagerTemplates;
    const tmpl = config[fieldTemplate];
    if (tmpl) {
      try {
        const compiled = template.compile(tmpl, groups, false);
        updateDependency(dependency, field, compiled);
      } catch {
        logger.warn(
          { template: tmpl },
          'Error compiling template for custom manager',
        );
        return null;
      }
    } else if (groups[field]) {
      updateDependency(dependency, field, groups[field]);
    }
  }
  dependency.replaceString = replaceString;
  return dependency;
}

export function regexMatchAll(
  regex: RegExp,
  content: string,
): RegExpMatchArray[] {
  const matches: RegExpMatchArray[] = [];
  let matchResult: RegExpMatchArray | null;
  let iterations = 0;
  const maxIterations = 10000;
  do {
    matchResult = regex.exec(content);
    if (matchResult) {
      matches.push(matchResult);
    }
    iterations += 1;
  } while (matchResult && iterations < maxIterations);
  if (iterations === maxIterations) {
    logger.warn('Max iterations reached for matchStrings');
  }
  return matches;
}

export function mergeGroups(
  mergedGroup: Record<string, string>,
  secondGroup: Record<string, string>,
): Record<string, string> {
  return { ...mergedGroup, ...secondGroup };
}

export function mergeExtractionTemplate(
  base: ExtractionTemplate,
  addition: ExtractionTemplate,
): ExtractionTemplate {
  return {
    groups: mergeGroups(base.groups, addition.groups),
    replaceString: addition.replaceString ?? base.replaceString,
  };
}

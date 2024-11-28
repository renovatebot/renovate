import { URL } from 'url';
import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import { logger } from '../../../../logger';
import * as template from '../../../../util/template';
import type { PackageDependency } from '../../types';
import type { JSONataManagerTemplates, JsonataExtractConfig } from './types';

export const validMatchFields = [
  'depName',
  'packageName',
  'currentValue',
  'currentDigest',
  'datasource',
  'versioning',
  'extractVersion',
  'registryUrl',
  'depType',
] as const;

type ValidMatchFields = (typeof validMatchFields)[number];

export async function handleMatching(
  json: unknown,
  packageFile: string,
  config: JsonataExtractConfig,
): Promise<PackageDependency[]> {
  // Pre-compile all JSONata expressions once
  const compiledExpressions = config.matchQueries
    .map((query) => {
      try {
        return jsonata(query);
      } catch (err) {
        logger.warn(
          { err },
          `Failed to compile JSONata query: ${query}. Excluding it from queries.`,
        );
        return null;
      }
    })
    .filter((expr) => expr !== null);

  // Execute all expressions in parallel
  const results = await Promise.all(
    compiledExpressions.map(async (expr) => {
      const result = (await expr.evaluate(json)) ?? [];
      return is.array(result) ? result : [result];
    }),
  );

  // Flatten results and create dependencies
  return results
    .flat()
    .map((queryResult) => {
      return createDependency(queryResult as Record<string, string>, config);
    })
    .filter((dep) => dep !== null);
}

export function createDependency(
  queryResult: Record<string, string>,
  config: JsonataExtractConfig,
): PackageDependency | null {
  const dependency: PackageDependency = {};

  function updateDependency(field: ValidMatchFields, value: string): void {
    switch (field) {
      case 'registryUrl':
        // check if URL is valid and pack inside an array
        try {
          const url = new URL(value).toString();
          dependency.registryUrls = [url];
        } catch {
          logger.warn({ value }, 'Invalid json manager registryUrl');
        }
        break;
      default:
        dependency[field] = value;
        break;
    }
  }

  for (const field of validMatchFields) {
    const fieldTemplate = `${field}Template` as keyof JSONataManagerTemplates;
    const tmpl = config[fieldTemplate];
    if (tmpl) {
      try {
        const compiled = template.compile(tmpl, queryResult, false);
        updateDependency(field, compiled);
      } catch {
        logger.warn(
          { template: tmpl },
          'Error compiling template for JSONata manager',
        );
        return null;
      }
    } else if (queryResult[field]) {
      updateDependency(field, queryResult[field]);
    }
  }
  return dependency;
}

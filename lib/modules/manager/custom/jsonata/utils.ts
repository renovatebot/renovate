import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import { logger } from '../../../../logger';
import * as template from '../../../../util/template';
import { parseUrl } from '../../../../util/url';
import type { PackageDependency } from '../../types';
import { QueryResultZodSchema } from './schema';
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
  const compiledExpressions = config.matchStrings
    .map((query) => {
      try {
        return jsonata(query);
      } catch (err) {
        logger.warn({ query, err }, 'Failed to compile JSONata query');
        return null;
      }
    })
    .filter((expr) => expr !== null);

  // Execute all expressions in parallel
  const results = await Promise.all(
    compiledExpressions.map(async (expr) => {
      try {
        // can either be a single object, an array of objects or undefined (no match)
        let result = (await expr.evaluate(json)) ?? [];
        if (is.emptyObject(result) || is.emptyArray(result)) {
          return [];
        }

        result = is.array(result) ? result : [result];

        QueryResultZodSchema.parse(result);
        return structuredClone(result);
      } catch (err) {
        logger.warn({ err }, 'Error while parsing dep info');
        return [];
      }
    }),
  );

  // Flatten results and create dependencies
  return results
    .flat()
    .map((queryResult) => {
      return createDependency(queryResult, config);
    })
    .filter((dep) => dep !== null);
}

export function createDependency(
  queryResult: Record<string, string>,
  config: JsonataExtractConfig,
): PackageDependency | null {
  const dependency: PackageDependency = {};

  for (const field of validMatchFields) {
    const fieldTemplate = `${field}Template` as keyof JSONataManagerTemplates;
    const tmpl = config[fieldTemplate];
    if (tmpl) {
      try {
        const compiled = template.compile(tmpl, queryResult, false);
        updateDependency(field, compiled, dependency);
      } catch {
        logger.warn(
          { template: tmpl },
          'Error compiling template for JSONata manager',
        );
        return null;
      }
    } else if (queryResult[field]) {
      updateDependency(field, queryResult[field], dependency);
    }
  }
  return dependency;
}

function updateDependency(
  field: ValidMatchFields,
  value: string,
  dependency: PackageDependency,
): PackageDependency {
  switch (field) {
    case 'registryUrl': {
      const url = parseUrl(value)?.toString();
      if (!url) {
        logger.warn({ url: value }, 'Invalid JSONata manager registryUrl');
        break;
      }
      dependency.registryUrls = [url];
      break;
    }
    default:
      dependency[field] = value;
      break;
  }

  return dependency;
}

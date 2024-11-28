import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import { logger } from '../../../../logger';
import type { PackageDependency, PackageFileContent } from '../../types';
import type { JSONataManagerTemplates, JsonataExtractConfig } from './types';
import { createDependency } from './utils';

export const supportedDatasources: string[] = ['*'];

export const defaultConfig = {
  fileMatch: [],
};

const validMatchFields = [
  'depName',
  'packageName',
  'currentValue',
  'currentDigest',
  'datasource',
  'versioning',
  'extractVersion',
  'registryUrl',
  'depType',
];

async function handleMatching(
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

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config: JsonataExtractConfig,
): Promise<PackageFileContent | null> {
  let deps: PackageDependency[];

  let json;
  try {
    json = JSON.parse(content);
  } catch (err) {
    logger.warn(
      { err, content, fileName: packageFile },
      `error parsing '${packageFile}'`,
    );
    return null;
  }

  deps = await handleMatching(json, packageFile, config);

  // filter all null values
  deps = deps.filter(is.truthy);
  if (deps.length) {
    const res: PackageFileContent & JSONataManagerTemplates = {
      deps,
      matchQueries: config.matchQueries,
    };
    // copy over templates for autoreplace
    for (const field of validMatchFields.map(
      (f) => `${f}Template` as keyof JSONataManagerTemplates,
    )) {
      if (config[field]) {
        res[field] = config[field];
      }
    }
    if (config.autoReplaceStringTemplate) {
      res.autoReplaceStringTemplate = config.autoReplaceStringTemplate;
    }
    return res;
  }

  return null;
}

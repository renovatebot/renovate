import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { HelmDatasource } from '../../datasource/helm';
import type { PackageDependency, PackageFile } from '../types';

function findDependencies(parsedContent: any): Array<PackageDependency> {
  if (!parsedContent || typeof parsedContent !== 'object') {
    return [];
  }

  if (is.emptyArray(parsedContent?.directories)) {
    logger.debug('Failed to find required "directories" field in vendir.yml');
    return [];
  }

  const deps: PackageDependency[] = [];
  for (const directory of parsedContent.directories) {
    if (is.emptyArray(directory?.contents)) {
      logger.debug('Failed to find required "contents" field');
      continue;
    }

    for (const content of directory.contents) {
      if (content.helmChart) {
        const element = content.helmChart;
        const dep: PackageDependency = {};
        if (!element.name || !element.version || !element?.repository.url) {
          dep.skipReason = 'invalid-dependency-specification';
        }
        if (!is.string(element.version)) {
          dep.skipReason = 'invalid-version';
          logger.warn(
            'Helm Chart dependency version is not a string and will be ignored'
          );
        }
        deps.push({
          datasource: HelmDatasource.id,
          currentValue: String(element.version),
          depName: element.name,
          registryUrls: [element?.repository.url],
        });
      } else {
        logger.debug('Skipping due to unsupported vendir dependency type');
      }
    }
  }
  return deps;
}

export function extractPackageFile(content: string): PackageFile | null {
  let parsedContent: Record<string, unknown>;
  try {
    // TODO: fix me (#9610)
    parsedContent = load(content, { json: true }) as any;
  } catch (err) {
    logger.debug({ err }, 'Failed to parse vendir YAML');
    return null;
  }
  try {
    const deps = findDependencies(parsedContent);
    if (deps.length) {
      return { deps };
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error parsing vendir parsed content');
  }
  return null;
}

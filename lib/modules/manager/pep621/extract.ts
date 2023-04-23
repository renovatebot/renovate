import toml from '@iarna/toml';
import { logger } from '../../../logger';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { PyProjectSchema } from './schema';
import { parseDependencyGroupRecord, parseDependencyList } from './utils';

export function extractPackageFile(
  content: string,
  fileName: string,
  config?: ExtractConfig
): PackageFileContent | null {
  logger.trace({ fileName }, 'pep621.extractPackageFile');

  const deps: PackageDependency[] = [];

  const jsonMap = toml.parse(content);
  const result = PyProjectSchema.safeParse(jsonMap);
  if (!result.success) {
    // TODO implement logging
    return null;
  }

  const def = result.data;
  deps.push(...parseDependencyList(def.project?.dependencies));
  deps.push(
    ...parseDependencyGroupRecord(def.project?.['optional-dependencies'])
  );
  deps.push(...parseDependencyGroupRecord(def.tool?.pdm?.['dev-dependencies']));

  return deps.length ? { deps } : null;
}

import { logger } from '../../../logger/index.ts';
import { Result } from '../../../util/result.ts';
import type { PackageFileContent } from '../types.ts';
import type { ToxConfig } from './schema.ts';
import { ToxFile, ToxPyProject } from './schema.ts';

function extractToxConfig(
  content: string,
  packageFile: string,
): ToxConfig | null {
  if (
    packageFile === 'pyproject.toml' ||
    packageFile.endsWith('/pyproject.toml')
  ) {
    const result = ToxPyProject.safeParse(content);
    if (!result.success) {
      logger.debug(
        { packageFile, error: result.error },
        `error parsing ${packageFile}`,
      );
      return null;
    }
    return result.data.tool.tox;
  }

  const { val, err } = Result.parse(content, ToxFile).unwrap();
  if (err) {
    logger.debug({ packageFile, err }, `error parsing ${packageFile}`);
    return null;
  }
  return val;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`tox.extractPackageFile(${packageFile})`);

  const config = extractToxConfig(content, packageFile);
  if (!config) {
    return null;
  }

  const deps = [
    ...config.requires,
    ...(config.env_run_base?.deps ?? []),
    ...(config.env ?? []),
  ];

  return deps.length ? { deps } : null;
}

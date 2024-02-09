import { logger } from '../../../logger';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract';
// TODO(not7cd): enable in the next PR, when this can be properly tested
// import { extractPackageFile as extractSetupPyFile } from '../pip_setup';
// import { extractPackageFile as extractSetupCfgFile } from '../setup-cfg';
import type { ExtractConfig, PackageFileContent } from '../types';
import type { SupportedManagers } from './types';

function matchManager(filename: string): SupportedManagers | 'unknown' {
  if (filename.endsWith('setup.py')) {
    return 'pip_setup';
  }
  if (filename.endsWith('setup.cfg')) {
    return 'setup-cfg';
  }
  if (filename.endsWith('pyproject.toml')) {
    return 'pep621';
  }
  // naive, could be improved, maybe use pip_requirements.fileMatch
  if (filename.endsWith('.in')) {
    return 'pip_requirements';
  }
  return 'unknown';
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  _config: ExtractConfig,
): PackageFileContent | null {
  logger.trace('pip-compile.extractPackageFile()');
  const manager = matchManager(packageFile);
  // TODO(not7cd): extract based on manager: pep621, setuptools, identify other missing source types
  switch (manager) {
    // TODO(not7cd): enable in the next PR, when this can be properly tested
    // case 'pip_setup':
    //   return extractSetupPyFile(content, _packageFile, _config);
    // case 'setup-cfg':
    //   return await extractSetupCfgFile(content);
    case 'pip_requirements':
      return extractRequirementsFile(content);
    case 'unknown':
      logger.warn(
        { packageFile },
        `pip-compile: could not determine manager for source file, fallback to pip_requirements`,
      );
      return extractRequirementsFile(content);
    default:
      logger.warn(
        { packageFile, manager },
        `pip-compile: support for manager is not yet implemented`,
      );
      return null;
  }
}

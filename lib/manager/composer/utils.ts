import { logger } from '../../logger';
import { api, id as composerVersioningId } from '../../versioning/composer';
import { UpdateArtifact } from '../common';

export { composerVersioningId };

export interface Repo {
  name?: string;
  type: 'composer' | 'git' | 'package' | 'vcs';
  packagist?: boolean;
  'packagist.org'?: boolean;
  url: string;
}
export interface ComposerConfig {
  type?: string;
  /**
   * A repositories field can be an array of Repo objects or an object of repoName: Repo
   * Also it can be a boolean (usually false) to disable packagist.
   * (Yes this can be confusing, as it is also not properly documented in the composer docs)
   * See https://getcomposer.org/doc/05-repositories.md#disabling-packagist-org
   */
  repositories: Record<string, Repo | boolean> | Repo[];

  require: Record<string, string>;
  'require-dev'?: Record<string, string>;
}

export function getConstraint(updateArtifact: UpdateArtifact): string {
  const { config, newPackageFileContent: content } = updateArtifact;
  const { constraints = {} } = config;
  const { composer } = constraints;

  if (composer) {
    logger.debug('Using composer constraint from config');
    return composer;
  }

  const composerJson = JSON.parse(content) as ComposerConfig;
  if (composerJson.require?.['composer/composer']) {
    return composerJson.require?.['composer/composer'];
  }

  if (composerJson['require-dev']?.['composer/composer']) {
    return composerJson['require-dev']?.['composer/composer'];
  }

  if (composerJson.require?.['composer-runtime-api']) {
    const major = api.getMajor(composerJson.require?.['composer-runtime-api']);
    return `${major}.*`;
  }

  return null;
}

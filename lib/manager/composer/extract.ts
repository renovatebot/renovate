import is from '@sindresorhus/is';
import * as datasourceGitTags from '../../datasource/git-tags';
import * as datasourcePackagist from '../../datasource/packagist';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { readLocalFile } from '../../util/fs';
import { api as semverComposer } from '../../versioning/composer';
import { PackageDependency, PackageFile } from '../common';

interface Repo {
  name?: string;
  type: 'composer' | 'git' | 'package' | 'vcs';
  packagist?: boolean;
  'packagist.org'?: boolean;
  url: string;
}

interface ComposerConfig {
  type?: string;
  /**
   * A repositories field can be an array of Repo objects or an object of repoName: Repo
   * Also it can be a boolean (usually false) to disable packagist.
   * (Yes this can be confusing, as it is also not properly documented in the composer docs)
   * See https://getcomposer.org/doc/05-repositories.md#disabling-packagist-org
   */
  repositories: Record<string, Repo | boolean> | Repo[];

  require: Record<string, string>;
  'require-dev': Record<string, string>;
}

/**
 * The regUrl is expected to be a base URL. GitLab composer repository installation guide specifies
 * to use a base URL containing packages.json. Composer still works in this scenario by determining
 * whether to add / remove packages.json from the URL.
 *
 * See https://github.com/composer/composer/blob/750a92b4b7aecda0e5b2f9b963f1cb1421900675/src/Composer/Repository/ComposerRepository.php#L815
 */
function transformRegUrl(url: string): string {
  return url.replace(/(\/packages\.json)$/, '');
}

/**
 * Parse the repositories field from a composer.json
 *
 * Entries with type vcs or git will be added to repositories,
 * other entries will be added to registryUrls
 */
function parseRepositories(
  repoJson: ComposerConfig['repositories'],
  repositories: Record<string, Repo>,
  registryUrls: string[]
): void {
  try {
    let packagist = true;
    Object.entries(repoJson).forEach(([key, repo]) => {
      if (is.object(repo)) {
        const name = is.array(repoJson) ? repo.name : key;
        // eslint-disable-next-line default-case
        switch (repo.type) {
          case 'vcs':
          case 'git':
            // eslint-disable-next-line no-param-reassign
            repositories[name] = repo;
            break;
          case 'composer':
            registryUrls.push(transformRegUrl(repo.url));
            break;
          case 'package':
            logger.debug(
              { url: repo.url },
              'type package is not supported yet'
            );
        }
        if (repo.packagist === false || repo['packagist.org'] === false) {
          packagist = false;
        }
      } else if (
        ['packagist', 'packagist.org'].includes(key) &&
        repo === false
      ) {
        packagist = false;
      }
    });
    if (packagist) {
      registryUrls.push('https://packagist.org');
    } else {
      logger.debug('Disabling packagist.org');
    }
  } catch (e) /* istanbul ignore next */ {
    logger.debug(
      { repositories: repoJson },
      'Error parsing composer.json repositories config'
    );
  }
}

export async function extractPackageFile(
  content: string,
  fileName: string
): Promise<PackageFile | null> {
  logger.trace(`composer.extractPackageFile(${fileName})`);
  let composerJson: ComposerConfig;
  try {
    composerJson = JSON.parse(content);
  } catch (err) {
    logger.debug({ fileName }, 'Invalid JSON');
    return null;
  }
  const repositories: Record<string, Repo> = {};
  const registryUrls: string[] = [];
  const res: PackageFile = { deps: [] };

  // handle lockfile
  const lockfilePath = fileName.replace(/\.json$/, '.lock');
  const lockContents = await readLocalFile(lockfilePath, 'utf8');
  let lockParsed;
  if (lockContents) {
    logger.debug({ packageFile: fileName }, 'Found composer lock file');
    try {
      lockParsed = JSON.parse(lockContents);
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ err }, 'Error processing composer.lock');
    }
  }

  // handle composer.json repositories
  if (composerJson.repositories) {
    parseRepositories(composerJson.repositories, repositories, registryUrls);
  }
  if (registryUrls.length !== 0) {
    res.registryUrls = registryUrls;
  }
  const deps = [];
  const depTypes = ['require', 'require-dev'];
  for (const depType of depTypes) {
    if (composerJson[depType]) {
      try {
        for (const [depName, version] of Object.entries(
          composerJson[depType] as Record<string, string>
        )) {
          const currentValue = version.trim();
          // Default datasource and lookupName
          let datasource = datasourcePackagist.id;
          let lookupName = depName;

          // Check custom repositories by type
          if (repositories[depName]) {
            // eslint-disable-next-line default-case
            switch (repositories[depName].type) {
              case 'vcs':
              case 'git':
                datasource = datasourceGitTags.id;
                lookupName = repositories[depName].url;
                break;
            }
          }
          const dep: PackageDependency = {
            depType,
            depName,
            currentValue,
            datasource,
          };
          if (depName !== lookupName) {
            dep.lookupName = lookupName;
          }
          if (!depName.includes('/')) {
            dep.skipReason = SkipReason.Unsupported;
          }
          if (currentValue === '*') {
            dep.skipReason = SkipReason.AnyVersion;
          }
          if (lockParsed) {
            const lockField =
              depType === 'require' ? 'packages' : 'packages-dev';
            const lockedDep = lockParsed?.[lockField]?.find(
              (item) => item.name === dep.depName
            );
            if (lockedDep && semverComposer.isVersion(lockedDep.version)) {
              dep.lockedVersion = lockedDep.version.replace(/^v/i, '');
            }
          }
          deps.push(dep);
        }
      } catch (err) /* istanbul ignore next */ {
        logger.debug({ fileName, depType, err }, 'Error parsing composer.json');
        return null;
      }
    }
  }
  if (!deps.length) {
    return null;
  }
  res.deps = deps;
  if (composerJson.type) {
    res.managerData = { composerJsonType: composerJson.type };
  }
  return res;
}

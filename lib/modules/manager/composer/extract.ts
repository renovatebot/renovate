import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { PackagistDatasource } from '../../datasource/packagist';
import { api as semverComposer } from '../../versioning/composer';
import type { PackageDependency, PackageFile } from '../types';
import type {
  ComposerConfig,
  ComposerLock,
  ComposerManagerData,
  ComposerRepositories,
  Repo,
} from './types';

/**
 * The regUrl is expected to be a base URL. GitLab composer repository installation guide specifies
 * to use a base URL containing packages.json. Composer still works in this scenario by determining
 * whether to add / remove packages.json from the URL.
 *
 * See https://github.com/composer/composer/blob/750a92b4b7aecda0e5b2f9b963f1cb1421900675/src/Composer/Repository/ComposerRepository.php#L815
 */
function transformRegUrl(url: string): string {
  return url.replace(regEx(/(\/packages\.json)$/), '');
}

/**
 * Parse the repositories field from a composer.json
 *
 * Entries with type vcs or git will be added to repositories,
 * other entries will be added to registryUrls
 */
function parseRepositories(
  repoJson: ComposerRepositories,
  repositories: Record<string, Repo>,
  registryUrls: string[]
): void {
  try {
    let packagist = true;
    Object.entries(repoJson).forEach(([key, repo]) => {
      if (is.object(repo)) {
        const name = is.array(repoJson) ? repo.name : key;

        switch (repo.type) {
          case 'vcs':
          case 'git':
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            repositories[name!] = repo;
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
      } // istanbul ignore else: invalid repo
      else if (['packagist', 'packagist.org'].includes(key) && repo === false) {
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
  const lockfilePath = fileName.replace(regEx(/\.json$/), '.lock');
  const lockContents = await readLocalFile(lockfilePath, 'utf8');
  let lockParsed: ComposerLock | undefined;
  if (lockContents) {
    logger.debug({ packageFile: fileName }, 'Found composer lock file');
    res.lockFiles = [lockfilePath];
    try {
      lockParsed = JSON.parse(lockContents) as ComposerLock;
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

  const deps: PackageDependency[] = [];
  const depTypes: ('require' | 'require-dev')[] = ['require', 'require-dev'];
  for (const depType of depTypes) {
    if (composerJson[depType]) {
      try {
        for (const [depName, version] of Object.entries(
          composerJson[depType]!
        )) {
          const currentValue = version.trim();
          // Default datasource and packageName
          let datasource = PackagistDatasource.id;
          let packageName = depName;

          // Check custom repositories by type
          if (repositories[depName]) {
            switch (repositories[depName].type) {
              case 'vcs':
              case 'git':
                datasource = GitTagsDatasource.id;
                packageName = repositories[depName].url;
                break;
            }
          }
          const dep: PackageDependency = {
            depType,
            depName,
            currentValue,
            datasource,
          };
          if (depName !== packageName) {
            dep.packageName = packageName;
          }
          if (!depName.includes('/')) {
            dep.skipReason = 'unsupported';
          }
          if (lockParsed) {
            const lockField =
              depType === 'require'
                ? 'packages'
                : /* istanbul ignore next */ 'packages-dev';
            const lockedDep = lockParsed[lockField]?.find(
              (item) => item.name === dep.depName
            );
            if (lockedDep && semverComposer.isVersion(lockedDep.version)) {
              dep.lockedVersion = lockedDep.version.replace(regEx(/^v/i), '');
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
  if (is.string(composerJson.type)) {
    const managerData: ComposerManagerData = {
      composerJsonType: composerJson.type,
    };
    res.managerData = managerData;
  }
  return res;
}

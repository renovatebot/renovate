import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { id as dockerVersioning } from '../../versioning/docker';
import { id as semverVersioning } from '../../versioning/semver';
import { getDep } from '../dockerfile/extract';
import type { ExtractConfig, PackageDependency } from '../types';
import { extractAllPackageFiles } from '.';

const fixturesDir = 'lib/modules/manager/batect/__fixtures__';

function createDockerDependency(tag: string): PackageDependency {
  return {
    ...getDep(tag),
    versioning: dockerVersioning,
  };
}

function createGitDependency(repo: string, version: string): PackageDependency {
  return {
    depName: repo,
    currentValue: version,
    versioning: semverVersioning,
    datasource: GitTagsDatasource.id,
    commitMessageTopic: 'bundle {{depName}}',
  };
}

const adminConfig: RepoGlobalConfig = {
  localDir: '',
};

const config: ExtractConfig = {};

describe('modules/manager/batect/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      GlobalConfig.set(adminConfig);
    });

    afterEach(() => {
      GlobalConfig.reset();
    });

    it('returns empty array for empty configuration file', async () => {
      expect(
        await extractAllPackageFiles(config, [
          `${fixturesDir}/empty/batect.yml`,
        ]),
      ).toEqual([]);
    });

    it('returns empty array for non-object configuration file', async () => {
      expect(
        await extractAllPackageFiles(config, [
          `${fixturesDir}/invalid/batect.yml`,
        ]),
      ).toEqual([]);
    });

    it('returns an a package file with no dependencies for configuration file without containers or includes', async () => {
      const result = await extractAllPackageFiles(config, [
        `${fixturesDir}/no-containers-or-includes/batect.yml`,
      ]);

      expect(result).toEqual([
        {
          packageFile: `${fixturesDir}/no-containers-or-includes/batect.yml`,
          deps: [],
        },
      ]);
    });

    it('extracts all available images and bundles from a valid Batect configuration file, including dependencies in included files', async () => {
      const result = await extractAllPackageFiles(config, [
        `${fixturesDir}/valid/batect.yml`,
      ]);

      // TODO: #22198
      expect(
        result?.sort((a, b) => a.packageFile.localeCompare(b.packageFile)),
      ).toEqual([
        {
          packageFile: `${fixturesDir}/valid/another-include.yml`,
          deps: [
            createDockerDependency('ubuntu:19.10'),
            createGitDependency(
              'https://another-include.com/my-repo.git',
              '4.5.6',
            ),
          ],
        },
        {
          packageFile: `${fixturesDir}/valid/batect.yml`,
          deps: [
            createDockerDependency('alpine:1.2.3'),
            createDockerDependency('alpine:1.2.3'),
            createDockerDependency('ubuntu:20.04'),
            createDockerDependency(
              'postgres:9.6.20@sha256:166179811e4c75f8a092367afed6091208c8ecf60b111c7e49f29af45ca05e08',
            ),
            createGitDependency('https://includes.com/my-repo.git', '1.2.3'),
            createGitDependency(
              'https://includes.com/my-other-repo.git',
              '4.5.6',
            ),
          ],
        },
        {
          packageFile: `${fixturesDir}/valid/include.yml`,
          deps: [
            createDockerDependency('ubuntu:20.10'),
            createGitDependency('https://include.com/my-repo.git', '4.5.6'),
          ],
        },
        {
          packageFile: `${fixturesDir}/valid/subdir/file.yml`,
          deps: [
            createDockerDependency('ubuntu:19.04'),
            createGitDependency('https://file.com/my-repo.git', '4.5.6'),
          ],
        },
      ]);
    });
  });
});

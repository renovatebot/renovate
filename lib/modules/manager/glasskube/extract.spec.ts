import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import { RepoGlobalConfig } from '../../../config/types';
import { GlasskubePackagesDatasource } from '../../datasource/glasskube-packages';
import { ExtractConfig } from '../types';
import { extractAllPackageFiles, extractPackageFile } from './extract';

const config: ExtractConfig = {};
const adminConfig: RepoGlobalConfig = { localDir: '' };

describe('modules/manager/glasskube/extract', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  describe('extractPackageFile()', () => {
    it('should extract version and registryUrl', () => {
      const deps = extractPackageFile(
        Fixtures.get('package-and-repo.yaml'),
        'package-and-repo.yaml',
      );
      expect(deps).toEqual({
        deps: [
          {
            depName: 'argo-cd',
            currentValue: 'v2.11.7+1',
            datasource: GlasskubePackagesDatasource.id,
            registryUrls: ['https://packages.dl.glasskube.dev/packages'],
          },
        ],
      });
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('should skip package with non-existing repo', async () => {
      const deps = await extractAllPackageFiles(config, [
        'lib/modules/manager/glasskube/__fixtures__/package.yaml',
      ]);
      expect(deps).toEqual([
        {
          packageFile:
            'lib/modules/manager/glasskube/__fixtures__/package.yaml',
          deps: [
            {
              depName: 'argo-cd',
              currentValue: 'v2.11.7+1',
              datasource: GlasskubePackagesDatasource.id,
              skipReason: 'unknown-registry',
            },
          ],
        },
      ]);
    });

    it('should extract registryUrl from repo in other file', async () => {
      const deps = await extractAllPackageFiles(config, [
        'lib/modules/manager/glasskube/__fixtures__/package.yaml',
        'lib/modules/manager/glasskube/__fixtures__/repo.yaml',
      ]);
      expect(deps).toEqual([
        {
          packageFile:
            'lib/modules/manager/glasskube/__fixtures__/package.yaml',
          deps: [
            {
              depName: 'argo-cd',
              currentValue: 'v2.11.7+1',
              datasource: GlasskubePackagesDatasource.id,
              registryUrls: ['https://packages.dl.glasskube.dev/packages'],
            },
          ],
        },
      ]);
    });

    it('should extract registryUrl from default repo in other file', async () => {
      const deps = await extractAllPackageFiles(config, [
        'lib/modules/manager/glasskube/__fixtures__/package-with-empty-reponame.yaml',
        'lib/modules/manager/glasskube/__fixtures__/package-with-missing-reponame.yaml',
        'lib/modules/manager/glasskube/__fixtures__/repo.yaml',
      ]);
      expect(deps).toEqual([
        {
          packageFile:
            'lib/modules/manager/glasskube/__fixtures__/package-with-empty-reponame.yaml',
          deps: [
            {
              depName: 'argo-cd',
              currentValue: 'v2.11.7+1',
              datasource: GlasskubePackagesDatasource.id,
              registryUrls: ['https://packages.dl.glasskube.dev/packages'],
            },
          ],
        },
        {
          packageFile:
            'lib/modules/manager/glasskube/__fixtures__/package-with-missing-reponame.yaml',
          deps: [
            {
              depName: 'argo-cd',
              currentValue: 'v2.11.7+1',
              datasource: GlasskubePackagesDatasource.id,
              registryUrls: ['https://packages.dl.glasskube.dev/packages'],
            },
          ],
        },
      ]);
    });
  });
});

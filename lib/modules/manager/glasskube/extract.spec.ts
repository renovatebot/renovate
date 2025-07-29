import { codeBlock } from 'common-tags';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { GlasskubePackagesDatasource } from '../../datasource/glasskube-packages';
import type { ExtractConfig } from '../types';
import { extractAllPackageFiles, extractPackageFile } from './extract';
import { Fixtures } from '~test/fixtures';
import { fs } from '~test/util';

const config: ExtractConfig = {};
const adminConfig: RepoGlobalConfig = { localDir: '' };

const packageWithRepoName = codeBlock`
apiVersion: packages.glasskube.dev/v1alpha1
kind: ClusterPackage
metadata:
  name: argo-cd
spec:
  packageInfo:
    name: argo-cd
    repositoryName: glasskube
    version: v2.11.7+1
`;
const repository = codeBlock`
apiVersion: packages.glasskube.dev/v1alpha1
kind: PackageRepository
metadata:
  annotations:
    packages.glasskube.dev/default-repository: "true"
  name: glasskube
spec:
  url: https://packages.dl.glasskube.dev/packages
`;

vi.mock('../../../util/fs');

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
    it('should return null for empty packageFiles', async () => {
      const deps = await extractAllPackageFiles(config, []);
      expect(deps).toBeNull();
    });

    it('should skip package with non-existing repo', async () => {
      fs.readLocalFile.mockResolvedValueOnce(packageWithRepoName);
      const deps = await extractAllPackageFiles(config, ['package.yaml']);
      expect(deps).toEqual([
        {
          packageFile: 'package.yaml',
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
      fs.readLocalFile.mockResolvedValueOnce(packageWithRepoName);
      fs.readLocalFile.mockResolvedValueOnce(repository);
      const deps = await extractAllPackageFiles(config, [
        'package.yaml',
        'repo.yaml',
      ]);
      expect(deps).toEqual([
        {
          packageFile: 'package.yaml',
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
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        apiVersion: packages.glasskube.dev/v1alpha1
        kind: ClusterPackage
        metadata:
          name: argo-cd
        spec:
          packageInfo:
            name: argo-cd
            version: v2.11.7+1
            repositoryName: ""
      `);
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        apiVersion: packages.glasskube.dev/v1alpha1
        kind: ClusterPackage
        metadata:
          name: argo-cd
        spec:
          packageInfo:
            name: argo-cd
            version: v2.11.7+1
      `);
      fs.readLocalFile.mockResolvedValueOnce(repository);
      const deps = await extractAllPackageFiles(config, [
        'package-with-empty-reponame.yaml',
        'package-with-missing-reponame.yaml',
        'repo.yaml',
      ]);
      expect(deps).toEqual([
        {
          packageFile: 'package-with-empty-reponame.yaml',
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
          packageFile: 'package-with-missing-reponame.yaml',
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

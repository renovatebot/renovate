import { codeBlock } from 'common-tags';
import { join } from 'upath';
import { mockExecAll } from '../../../../test/exec-util';
import { fs, mockedFunction } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { getPkgReleases as _getPkgReleases } from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from './artifacts';

jest.mock('../../../util/fs');
jest.mock('../../datasource');

const getPkgReleases = mockedFunction(_getPkgReleases);

const config: UpdateArtifactsConfig = {};
const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

describe('modules/manager/pep621/artifacts', () => {
  describe('updateArtifacts()', () => {
    it('return null if all processors returns are empty', async () => {
      const updatedDeps = [
        {
          packageName: 'dep1',
        },
      ];
      const result = await updateArtifacts({
        packageFileName: 'pyproject.toml',
        newPackageFileContent: '',
        config,
        updatedDeps,
      });
      expect(result).toBeNull();
    });

    it('return artifact error if newPackageFile content is not valid', async () => {
      const updatedDeps = [
        {
          packageName: 'dep1',
        },
      ];
      const result = await updateArtifacts({
        packageFileName: 'pyproject.toml',
        newPackageFileContent: '--test string--',
        config,
        updatedDeps,
      });
      expect(result).toEqual([
        {
          artifactError: { stderr: 'Failed to parse new package file content' },
        },
      ]);
    });

    it('return processor result', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
      });
      fs.getSiblingFileName.mockReturnValueOnce('pdm.lock');
      fs.readLocalFile.mockResolvedValueOnce('old test content');
      fs.readLocalFile.mockResolvedValueOnce('new test content');
      // python
      getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '3.7.1' },
          { version: '3.8.1' },
          { version: '3.11.2' },
        ],
      });
      // pdm
      getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: 'v2.6.1' }, { version: 'v2.5.0' }],
      });

      const updatedDeps = [{ packageName: 'dep1' }];
      const result = await updateArtifacts({
        packageFileName: 'pyproject.toml',
        newPackageFileContent: codeBlock`
[project]
name = "pdm"
dynamic = ["version"]
requires-python = "<3.9"
        `,
        config: {},
        updatedDeps,
      });
      expect(result).toEqual([
        {
          file: {
            contents: 'new test content',
            path: 'pdm.lock',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker pull ghcr.io/containerbase/sidecar',
          options: {
            encoding: 'utf-8',
          },
        },
        {
          cmd: 'docker ps --filter name=renovate_sidecar -aq',
          options: {
            encoding: 'utf-8',
          },
        },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e BUILDPACK_CACHE_DIR ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/containerbase/sidecar ' +
            'bash -l -c "' +
            'install-tool python 3.8.1 ' +
            '&& ' +
            'install-tool pdm v2.5.0 ' +
            '&& ' +
            'pdm update --no-sync dep1' +
            '"',
          options: {
            cwd: '/tmp/github/some/repo',
            encoding: 'utf-8',
            env: {
              BUILDPACK_CACHE_DIR: '/tmp/cache/containerbase',
              CONTAINERBASE_CACHE_DIR: '/tmp/cache/containerbase',
            },
          },
        },
      ]);
    });
  });
});

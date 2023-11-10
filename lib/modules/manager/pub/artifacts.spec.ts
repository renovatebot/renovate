import { codeBlock } from 'common-tags';
import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import * as _datasource from '../../datasource';
import type { UpdateArtifact, UpdateArtifactsConfig } from '../types';
import * as pub from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../../../util/http');
jest.mock('../../datasource', () => mockDeep());

process.env.CONTAINERBASE = 'true';

const lockFile = 'pubspec.lock';
const oldLockFileContent = 'Old pubspec.lock';
const newLockFileContent = 'New pubspec.lock';
const depNames = ['dep1', 'dep2', 'dep3'];
const depNamesWithSdks = [...depNames, ...['dart', 'flutter']];
const depNamesWithSpace = depNames.join(' ');

const datasource = mocked(_datasource);

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {};

const updateArtifact: UpdateArtifact = {
  packageFileName: 'pubspec.yaml',
  updatedDeps: depNamesWithSdks.map((depName) => {
    return { depName };
  }),
  newPackageFileContent: '',
  config,
};

describe('modules/manager/pub/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();

    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '2.10.5' }, { version: '3.3.9' }],
    });
  });

  afterEach(() => {
    GlobalConfig.set(adminConfig);
  });

  it('returns null if no pubspec.lock found', async () => {
    expect(await pub.updateArtifacts(updateArtifact)).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await pub.updateArtifacts({ ...updateArtifact, updatedDeps: [] }),
    ).toBeNull();
  });

  it(`runs flutter pub get if only dart and flutter sdks are updated`, async () => {
    const execSnapshots = mockExecAll();
    fs.getSiblingFileName.mockReturnValueOnce(lockFile);
    fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
    fs.readLocalFile.mockResolvedValueOnce(newLockFileContent);
    expect(
      await pub.updateArtifacts({
        ...updateArtifact,
        newPackageFileContent: codeBlock`
          environment:
            sdk: ^3.0.0
            flutter: 2.0.0
        `,
        updatedDeps: [{ depName: 'dart' }, { depName: 'flutter' }],
      }),
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: lockFile,
          contents: newLockFileContent,
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'flutter pub get --no-precompile',
      },
    ]);
  });

  describe.each([
    { sdk: 'dart', packageFileContent: '' },
    { sdk: 'flutter', packageFileContent: 'sdk: flutter' },
  ])('validates pub tools', (params) => {
    it(`returns null for ${params.sdk} if unchanged`, async () => {
      const execSnapshots = mockExecAll();
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
        }),
      ).toBeNull();
      expect(execSnapshots).toMatchObject([
        {
          cmd: `${params.sdk} pub upgrade ${depNamesWithSpace}`,
        },
      ]);
    });

    it(`returns updated ${params.sdk} pubspec.lock`, async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce(lockFile);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent);
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: lockFile,
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: `${params.sdk} pub upgrade ${depNamesWithSpace}`,
        },
      ]);
    });

    it(`runs ${params.sdk} pub get if only the sdk is updated`, async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce(lockFile);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent);
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
          updatedDeps: [{ depName: params.sdk }],
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: lockFile,
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: `${params.sdk} pub get --no-precompile`,
        },
      ]);
    });

    it(`returns updated ${params.sdk} pubspec.lock for lockfile maintenance`, async () => {
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce(lockFile);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent);
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
          config: { ...config, updateType: 'lockFileMaintenance' },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: lockFile,
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: `${params.sdk} pub upgrade`,
        },
      ]);
    });

    it(`supports ${params.sdk} docker mode`, async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
      });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce(lockFile);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent);
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: lockFile,
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'docker pull ghcr.io/containerbase/sidecar',
        },
        {
          cmd: 'docker ps --filter name=renovate_sidecar -aq',
        },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/containerbase/sidecar ' +
            'bash -l -c "' +
            `install-tool ${params.sdk} 3.3.9` +
            ' && ' +
            `${params.sdk} pub upgrade ${depNamesWithSpace}` +
            '"',
        },
      ]);
    });

    it(`supports ${params.sdk} install mode`, async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      const execSnapshots = mockExecAll();
      fs.getSiblingFileName.mockReturnValueOnce(lockFile);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent);
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
          config: { ...config, constraints: { dart: '3.3.9' } },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: lockFile,
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: `install-tool ${params.sdk} 3.3.9` },
        { cmd: `${params.sdk} pub upgrade ${depNamesWithSpace}` },
      ]);
    });

    it(`catches errors for ${params.sdk}`, async () => {
      const stderr = 'not found';
      fs.getSiblingFileName.mockReturnValueOnce(lockFile);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent);
      fs.writeLocalFile.mockImplementationOnce(() => {
        throw new Error(stderr);
      });
      expect(
        await pub.updateArtifacts({
          ...updateArtifact,
          newPackageFileContent: params.packageFileContent,
        }),
      ).toEqual([{ artifactError: { lockFile, stderr } }]);
    });
  });
});

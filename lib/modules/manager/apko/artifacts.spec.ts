import { codeBlock } from 'common-tags';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { UpdateArtifact } from '../types';
import { updateArtifacts } from './artifacts';
import { mockExecAll } from '~test/exec-util';
import { fs } from '~test/util';

vi.mock('../../../util/exec/env');
vi.mock('../../../util/fs');

const globalConfig: RepoGlobalConfig = {
  localDir: '',
};

const apkoYaml = codeBlock`
  contents:
    repositories:
      - https://dl-cdn.alpinelinux.org/alpine/edge/main
    packages:
      - alpine-base
      - nginx-1.24.0
      - nodejs-20.10.0

  cmd: /bin/sh -l

  environment:
    PATH: /usr/local/sbin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin

  archs:
    - amd64
`;

describe('modules/manager/apko/artifacts', () => {
  describe('updateArtifacts()', () => {
    let updateArtifact: UpdateArtifact;

    beforeEach(() => {
      GlobalConfig.set(globalConfig);
      updateArtifact = {
        config: {},
        newPackageFileContent: '',
        packageFileName: '',
        updatedDeps: [],
      };
    });

    it('skips if no lockFileMaintenance', async () => {
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('skips if no lock file exists', async () => {
      updateArtifact.config = { isLockFileMaintenance: true };
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns updated apko.lock.json for lock file maintenance', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('apko.lock.json');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      const execSnapshots = mockExecAll();
      const oldLockFileContent = Buffer.from('Old apko.lock.json');
      const newLockFileContent = Buffer.from('New apko.lock.json');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'apko.yaml',
          newPackageFileContent: apkoYaml,
          updatedDeps: [],
          config: { isLockFileMaintenance: true },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'apko.lock.json',
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'apko lock apko.yaml',
          options: {
            cwd: '.',
            encoding: 'utf-8',
            env: {},
            maxBuffer: 10485760,
            timeout: 900000,
          },
        },
      ]);
    });

    it('returns null if lock file content is unchanged', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('apko.lock.json');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      const execSnapshots = mockExecAll();
      const lockFileContent = Buffer.from('Same content');
      fs.readLocalFile.mockResolvedValueOnce(lockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(lockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'apko.yaml',
          newPackageFileContent: apkoYaml,
          updatedDeps: [],
          config: { isLockFileMaintenance: true },
        }),
      ).toBeNull();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'apko lock apko.yaml',
          options: {
            cwd: '.',
            encoding: 'utf-8',
            env: {},
            maxBuffer: 10485760,
            timeout: 900000,
          },
        },
      ]);
    });

    it('returns error if apko command fails', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('apko.lock.json');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      const execSnapshots = mockExecAll(new Error('apko command failed'));
      const oldLockFileContent = Buffer.from('Old apko.lock.json');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'apko.yaml',
          newPackageFileContent: apkoYaml,
          updatedDeps: [],
          config: { isLockFileMaintenance: true },
        }),
      ).toEqual([
        {
          artifactError: {
            lockFile: 'apko.lock.json',
            stderr: 'apko command failed',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'apko lock apko.yaml',
          options: {
            cwd: '.',
            encoding: 'utf-8',
            env: {},
            maxBuffer: 10485760,
            timeout: 900000,
          },
        },
      ]);
    });

    it('returns null if new lock file cannot be read', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('apko.lock.json');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      const execSnapshots = mockExecAll();
      const oldLockFileContent = Buffer.from('Old apko.lock.json');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(null as never);
      expect(
        await updateArtifacts({
          packageFileName: 'apko.yaml',
          newPackageFileContent: apkoYaml,
          updatedDeps: [],
          config: { isLockFileMaintenance: true },
        }),
      ).toBeNull();
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'apko lock apko.yaml',
          options: {
            cwd: '.',
            encoding: 'utf-8',
            env: {},
            maxBuffer: 10485760,
            timeout: 900000,
          },
        },
      ]);
    });

    it('handles different package file names', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('apko.lock.json');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      const execSnapshots = mockExecAll();
      const oldLockFileContent = Buffer.from('Old apko.lock.json');
      const newLockFileContent = Buffer.from('New apko.lock.json');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'config/apko.yml',
          newPackageFileContent: apkoYaml,
          updatedDeps: [],
          config: { isLockFileMaintenance: true },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'apko.lock.json',
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'apko lock apko.yml',
          options: {
            cwd: 'config',
            encoding: 'utf-8',
            env: {},
            maxBuffer: 10485760,
            timeout: 900000,
          },
        },
      ]);

      // Verify that getSiblingFileName was called with the correct lockfile name
      expect(fs.getSiblingFileName).toHaveBeenCalledWith(
        'config/apko.yml',
        'apko.lock.json',
      );
    });

    it('uses custom lockfile name based on package file name', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('image.lock.json');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      const execSnapshots = mockExecAll();
      const oldLockFileContent = Buffer.from('Old image.lock.json');
      const newLockFileContent = Buffer.from('New image.lock.json');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'image.yaml',
          newPackageFileContent: apkoYaml,
          updatedDeps: [],
          config: { isLockFileMaintenance: true },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'image.lock.json',
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'apko lock image.yaml',
          options: {
            cwd: '.',
            encoding: 'utf-8',
            env: {},
            maxBuffer: 10485760,
            timeout: 900000,
          },
        },
      ]);

      // Verify that getSiblingFileName was called with the correct lockfile name
      expect(fs.getSiblingFileName).toHaveBeenCalledWith(
        'image.yaml',
        'image.lock.json',
      );
    });
  });
});

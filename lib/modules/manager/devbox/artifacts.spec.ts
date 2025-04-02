import { codeBlock } from 'common-tags';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { StatusResult } from '../../../util/git/types';
import type { UpdateArtifact } from '../types';
import { updateArtifacts } from './artifacts';
import { mockExecAll } from '~test/exec-util';
import { fs, git, partial } from '~test/util';

vi.mock('../../../util/exec/env');
vi.mock('../../../util/fs');

const globalConfig: RepoGlobalConfig = {
  localDir: '',
};

const devboxJson = codeBlock`
  {
    "$schema": "https://raw.githubusercontent.com/jetpack-io/devbox/0.10.1/.schema/devbox.schema.json",
    "packages": ["nodejs@20", "metabase@0.49.1", "postgresql@latest", "gh@latest"],
  }
`;

describe('modules/manager/devbox/artifacts', () => {
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

    it('skips if no updatedDeps and no lockFileMaintenance', async () => {
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('skips if no lock file in config', async () => {
      updateArtifact.updatedDeps = [{}];
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('skips if cannot read lock file', async () => {
      updateArtifact.updatedDeps = [
        { manager: 'devbox', lockFiles: ['devbox.lock'] },
      ];
      expect(await updateArtifacts(updateArtifact)).toBeNull();
    });

    it('returns installed devbox.lock', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      const execSnapshots = mockExecAll();
      const oldLockFileContent = Buffer.from('Old devbox.lock');
      const newLockFileContent = Buffer.from('New devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'devbox.json',
          newPackageFileContent: devboxJson,
          updatedDeps: [
            {
              manager: 'devbox',
              lockFiles: ['devbox.lock'],
              depName: 'nodejs',
            },
          ],
          config: {},
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'devbox.lock',
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'devbox update nodejs --no-install',
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

    it('calls install instead of update --no-install if an older version of devbox is constrained', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      const execSnapshots = mockExecAll();
      const oldLockFileContent = Buffer.from('Old devbox.lock');
      const newLockFileContent = Buffer.from('New devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'devbox.json',
          newPackageFileContent: devboxJson,
          updatedDeps: [
            {
              manager: 'devbox',
              lockFiles: ['devbox.lock'],
              depName: 'nodejs',
            },
          ],
          config: {
            constraints: {
              devbox: '0.13.0',
            },
          },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'devbox.lock',
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'devbox install',
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

    it('returns installed devbox.lock with multiple updated deps', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      const execSnapshots = mockExecAll();
      const oldLockFileContent = Buffer.from('Old devbox.lock');
      const newLockFileContent = Buffer.from('New devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'devbox.json',
          newPackageFileContent: devboxJson,
          updatedDeps: [
            {
              manager: 'devbox',
              lockFiles: ['devbox.lock'],
              depName: 'nodejs',
            },
            {
              manager: 'devbox',
              lockFiles: ['devbox.lock'],
              depName: 'ruby',
            },
          ],
          config: {},
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'devbox.lock',
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'devbox update nodejs --no-install',
          options: {
            cwd: '.',
            encoding: 'utf-8',
            env: {},
            maxBuffer: 10485760,
            timeout: 900000,
          },
        },
        {
          cmd: 'devbox update ruby --no-install',
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

    it('returns null if no updatedDeps are passed', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      const oldLockFileContent = Buffer.from('Old devbox.lock');
      const newLockFileContent = Buffer.from('New devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'devbox.json',
          newPackageFileContent: devboxJson,
          updatedDeps: [{}],
          config: {},
        }),
      ).toBeNull();
    });

    it('returns null if no updatedDeps have depNames', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const oldLockFileContent = Buffer.from('Old devbox.lock');
      const newLockFileContent = Buffer.from('New devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'devbox.json',
          newPackageFileContent: devboxJson,
          updatedDeps: [
            {
              manager: 'devbox',
              lockFiles: ['devbox.lock'],
            },
          ],
          config: {},
        }),
      ).toBeNull();
    });

    it('returns updated devbox.lock', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['devbox.lock'],
        }),
      );
      const oldLockFileContent = Buffer.from('old devbox.lock');
      const newLockFileContent = Buffer.from('New devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'devbox.json',
          newPackageFileContent: devboxJson,
          updatedDeps: [{}],
          config: {
            isLockFileMaintenance: true,
          },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'devbox.lock',
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'devbox update --no-install',
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

    it('calls update without --no-install flag if an older version of devbox is being used', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['devbox.lock'],
        }),
      );
      const oldLockFileContent = Buffer.from('old devbox.lock');
      const newLockFileContent = Buffer.from('New devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'devbox.json',
          newPackageFileContent: devboxJson,
          updatedDeps: [{}],
          config: {
            isLockFileMaintenance: true,
            constraints: {
              devbox: '< 0.14.0',
            },
          },
        }),
      ).toEqual([
        {
          file: {
            type: 'addition',
            path: 'devbox.lock',
            contents: newLockFileContent,
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'devbox update',
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

    it('returns null if no changes are found', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
        }),
      );
      mockExecAll();
      expect(
        await updateArtifacts({
          packageFileName: 'devbox.json',
          newPackageFileContent: devboxJson,
          updatedDeps: [],
          config: {},
        }),
      ).toBeNull();
    });

    it('returns null if devbox.lock not found after update', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
        }),
      );
      mockExecAll();
      const oldLockFileContent = Buffer.from('Old devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'devbox.json',
          newPackageFileContent: devboxJson,
          updatedDeps: [
            {
              manager: 'devbox',
              lockFiles: ['devbox.lock'],
              depName: 'nodejs',
            },
          ],
          config: {},
        }),
      ).toBeNull();
    });

    it('returns null if devbox.lock not found', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
        }),
      );
      mockExecAll();
      fs.readLocalFile.mockResolvedValueOnce(null);
      expect(
        await updateArtifacts({
          packageFileName: 'devbox.json',
          newPackageFileContent: devboxJson,
          updatedDeps: [
            {
              manager: 'devbox',
              lockFiles: ['devbox.lock'],
              depName: 'nodejs',
            },
          ],
          config: {},
        }),
      ).toBeNull();
    });

    it('returns null if no lock file changes are found', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(`{}`);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
        }),
      );
      mockExecAll();
      const oldLockFileContent = Buffer.from('Old devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'devbox.json',
          newPackageFileContent: devboxJson,
          updatedDeps: [
            {
              manager: 'devbox',
              lockFiles: ['devbox.lock'],
              depName: 'nodejs',
            },
          ],
          config: {},
        }),
      ).toBeNull();
    });

    it('returns an artifact error on failure', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('devbox.lock');
      const newLockFileContent = `{}`;
      const oldLockFileContent = Buffer.from('New devbox.lock');
      fs.readLocalFile.mockResolvedValueOnce(oldLockFileContent as never);
      fs.readLocalFile.mockResolvedValueOnce(newLockFileContent as never);
      expect(
        await updateArtifacts({
          packageFileName: 'devbox.json',
          newPackageFileContent: devboxJson,
          updatedDeps: [
            {
              manager: 'devbox',
              lockFiles: ['devbox.lock'],
              depName: 'nodejs',
            },
          ],
          config: {},
        }),
      ).toEqual([
        {
          artifactError: {
            lockFile: 'devbox.lock',
            stderr: "Cannot read properties of undefined (reading 'stdout')",
          },
        },
      ]);
    });
  });
});

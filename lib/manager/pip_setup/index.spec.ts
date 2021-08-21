import {
  ExecSnapshots,
  envMock,
  exec,
  mockExecAll,
  mockExecSequence,
} from '../../../test/exec-util';
import { env, loadFixture } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import * as fs from '../../util/fs';
import type { ExtractConfig } from '../types';
import * as extract from './extract';
import { extractPackageFile } from '.';

const packageFile = 'setup.py';
const content = loadFixture(packageFile);
const jsonContent = loadFixture('setup.py.json');

const adminConfig: RepoGlobalConfig = {
  localDir: '/tmp/github/some/repo',
  cacheDir: '/tmp/renovate/cache',
};

const config: ExtractConfig = {};

jest.mock('child_process');
jest.mock('../../util/exec/env');

const pythonVersionCallResults = [
  { stdout: '', stderr: 'Python 2.7.17\\n' },
  { stdout: 'Python 3.7.5\\n', stderr: '' },
];

// TODO: figure out snapshot similarity for each CI platform (#9617)
const fixSnapshots = (snapshots: ExecSnapshots): ExecSnapshots =>
  snapshots.map((snapshot) => ({
    ...snapshot,
    cmd: snapshot.cmd.replace(/^.*extract\.py"\s+/, '<extract.py> '),
  }));

describe('manager/pip_setup/index', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.resetModules();
      extract.resetModule();

      setGlobalConfig(adminConfig);
      env.getChildProcessEnv.mockReturnValue(envMock.basic);

      // do not copy extract.py
      jest.spyOn(fs, 'writeLocalFile').mockResolvedValue();
    });

    afterEach(() => {
      setGlobalConfig();
    });

    it('returns found deps', async () => {
      const execSnapshots = mockExecSequence(exec, [
        ...pythonVersionCallResults,
        {
          stdout: '',
          stderr:
            'DeprecationWarning: the imp module is deprecated in favour of importlib',
        },
      ]);
      jest.spyOn(fs, 'readLocalFile').mockResolvedValueOnce(jsonContent);
      // FIXME: explicit assert condition
      expect(
        await extractPackageFile(content, packageFile, config)
      ).toMatchSnapshot();
      expect(exec).toHaveBeenCalledTimes(3);
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    });

    it('returns found deps (docker)', async () => {
      setGlobalConfig({ ...adminConfig, binarySource: 'docker' });
      const execSnapshots = mockExecAll(exec, { stdout: '', stderr: '' });

      jest.spyOn(fs, 'readLocalFile').mockResolvedValueOnce(jsonContent);
      expect(
        await extractPackageFile(content, packageFile, config)
      ).toMatchSnapshot();
      expect(execSnapshots).toHaveLength(3); // TODO: figure out volume arguments in Windows (#9617)
    });

    it('returns no deps', async () => {
      const execSnapshots = mockExecSequence(exec, [
        ...pythonVersionCallResults,
        {
          stdout: '',
          stderr: 'fatal: No names found, cannot describe anything.',
        },
      ]);
      jest.spyOn(fs, 'readLocalFile').mockResolvedValueOnce('{}');
      expect(await extractPackageFile(content, packageFile, config)).toBeNull();
      expect(exec).toHaveBeenCalledTimes(3);
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    });

    it('should return null for invalid file', async () => {
      const execSnapshots = mockExecSequence(exec, [
        ...pythonVersionCallResults,
        new Error(),
      ]);
      expect(
        await extractPackageFile(
          'raise Exception()',
          'folders/foobar.py',
          config
        )
      ).toBeNull();
      expect(exec).toHaveBeenCalledTimes(3);
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    });
    it('catches error', async () => {
      const execSnapshots = mockExecAll(exec, new Error());
      expect(
        await extractPackageFile(
          'raise Exception()',
          'folders/foobar.py',
          config
        )
      ).toBeNull();
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    });
  });
});

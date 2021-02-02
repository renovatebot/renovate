import { readFileSync } from 'fs';
import {
  ExecSnapshots,
  envMock,
  exec,
  mockExecAll,
  mockExecSequence,
} from '../../../test/exec-util';
import { env, getName } from '../../../test/util';
import { setUtilConfig } from '../../util';
import { BinarySource } from '../../util/exec/common';
import * as fs from '../../util/fs';
import * as extract from './extract';
import { extractPackageFile } from '.';

const packageFile = 'lib/manager/pip_setup/__fixtures__/setup.py';
const content = readFileSync(packageFile, 'utf8');

const packageFileJson = 'lib/manager/pip_setup/__fixtures__/setup.py.json';
const jsonContent = readFileSync(packageFileJson, 'utf8');

const config = {
  localDir: '/tmp/github/some/repo',
  cacheDir: '/tmp/renovate/cache',
};

jest.mock('child_process');
jest.mock('../../util/exec/env');

const pythonVersionCallResults = [
  { stdout: '', stderr: 'Python 2.7.17\\n' },
  { stdout: 'Python 3.7.5\\n', stderr: '' },
];

// TODO: figure out snapshot similarity for each CI platform
const fixSnapshots = (snapshots: ExecSnapshots): ExecSnapshots =>
  snapshots.map((snapshot) => ({
    ...snapshot,
    cmd: snapshot.cmd.replace(/^.*extract\.py"\s+/, '<extract.py> '),
  }));

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
      extract.resetModule();

      await setUtilConfig(config);
      env.getChildProcessEnv.mockReturnValue(envMock.basic);

      // do not copy extract.py
      jest.spyOn(fs, 'writeLocalFile').mockResolvedValue();
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
      expect(
        await extractPackageFile(content, packageFile, config)
      ).toMatchSnapshot();
      expect(exec).toHaveBeenCalledTimes(3);
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    });

    it('returns found deps (docker)', async () => {
      const execSnapshots = mockExecSequence(exec, [
        { stdout: '', stderr: '' },
      ]);

      jest.spyOn(fs, 'readLocalFile').mockResolvedValueOnce(jsonContent);
      expect(
        await extractPackageFile(content, packageFile, {
          ...config,
          binarySource: BinarySource.Docker,
        })
      ).toMatchSnapshot();
      expect(execSnapshots).toHaveLength(1); // TODO: figure out volume arguments in Windows
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

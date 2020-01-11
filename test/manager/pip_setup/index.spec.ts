import { readFileSync } from 'fs';
import { exec as _exec } from 'child_process';
import * as extract from '../../../lib/manager/pip_setup/extract';
import { extractPackageFile } from '../../../lib/manager/pip_setup';
import {
  ExecSnapshots,
  envMock,
  mockExecAll,
  mockExecSequence,
} from '../../execUtil';
import * as _env from '../../../lib/util/exec/env';
import { mocked } from '../../util';

const packageFile = 'test/manager/pip_setup/_fixtures/setup.py';
const content = readFileSync(packageFile, 'utf8');

const packageFileJson = 'test/manager/pip_setup/_fixtures/setup.py.json';
const jsonContent = readFileSync(packageFileJson, 'utf8');

const config = {
  localDir: '/tmp/github/some/repo',
};

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

jest.mock('child_process');
jest.mock('../../../lib/util/exec/env');

const pythonVersionCallResults = [
  { stdout: '', stderr: 'Python 2.7.17\\n' },
  { stdout: 'Python 3.7.5\\n', stderr: '' },
  new Error(),
];

// TODO: figure out snapshot similarity for each CI platform
const fixSnapshots = (snapshots: ExecSnapshots): ExecSnapshots =>
  snapshots.map(snapshot => ({
    ...snapshot,
    cmd: snapshot.cmd.replace(/^.*\/extract\.py"\s+/, '<extract.py> '),
  }));

describe('lib/manager/pip_setup/index', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.resetModules();
      extract.resetModule();

      env.getChildProcessEnv.mockReturnValue(envMock.basic);
    });
    it('returns found deps', async () => {
      const execSnapshots = mockExecSequence(exec, [
        ...pythonVersionCallResults,
        { stdout: jsonContent, stderr: '' },
      ]);
      expect(
        await extractPackageFile(content, packageFile, config)
      ).toMatchSnapshot();
      expect(exec).toHaveBeenCalledTimes(4);
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    });
    it('returns found deps (docker)', async () => {
      const execSnapshots = mockExecSequence(exec, [
        { stdout: '', stderr: '' }, // docker pull
        { stdout: jsonContent, stderr: '' },
      ]);

      expect(
        await extractPackageFile(content, packageFile, {
          ...config,
          binarySource: 'docker',
        })
      ).toMatchSnapshot();
      expect(execSnapshots).toHaveLength(2); // TODO: figure out volume arguments in Windows
    });
    it('should return null for invalid file', async () => {
      const execSnapshots = mockExecSequence(exec, [
        ...pythonVersionCallResults,
        new Error(),
      ]);
      expect(
        await extractPackageFile(
          'raise Exception()',
          '/tmp/folders/foobar.py',
          config
        )
      ).toBeNull();
      expect(exec).toHaveBeenCalledTimes(4);
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    });
    it('catches error', async () => {
      const execSnapshots = mockExecAll(exec, new Error());
      expect(
        await extractPackageFile(
          'raise Exception()',
          '/tmp/folders/foobar.py',
          config
        )
      ).toBeNull();
      expect(fixSnapshots(execSnapshots)).toMatchSnapshot();
    });
  });
  /*
  describe('extractSetupFile()', () => {
    it('should return parsed setup() call', async () => {
      expect(
        await extractSetupFile(content, packageFile, config)
      ).toMatchSnapshot();
    });
    it('should support setuptools', async () => {
      expect(
        await extractSetupFile(
          'from setuptools import setup\nsetup(name="talisker")\n',
          await tmpFile(),
          config
        )
      ).toEqual({ name: 'talisker' });
    });
    it('should support distutils.core', async () => {
      expect(
        await extractSetupFile(
          'from distutils.core import setup\nsetup(name="talisker")\n',
          await tmpFile(),
          config
        )
      ).toEqual({ name: 'talisker' });
    });
  });
  */
});

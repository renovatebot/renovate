import { readFileSync } from 'fs';
import { exec as _exec } from 'child_process';
import { file as _file } from 'tmp-promise';
import { relative } from 'path';
import * as extract from '../../../lib/manager/pip_setup/extract';
import { extractPackageFile } from '../../../lib/manager/pip_setup';

const packageFile = 'test/manager/pip_setup/_fixtures/setup.py';
const content = readFileSync(packageFile, 'utf8');

const packageFileJson = 'test/manager/pip_setup/_fixtures/setup.py.json';
const jsonContent = readFileSync(packageFileJson, 'utf8');

const config = {
  localDir: '.',
};

const exec: jest.Mock<typeof _exec> = _exec as any;
jest.mock('child_process');

async function tmpFile() {
  const file = await _file({ postfix: '.py' });
  return relative('.', file.path);
}

describe('lib/manager/pip_setup/index', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.resetModules();
      extract.resetModule();

      exec.mockImplementationOnce((_cmd, _options, callback) => {
        callback(null, { stdout: '', stderr: 'Python 2.7.17\\n' });
        return undefined;
      });
      exec.mockImplementationOnce((_cmd, _options, callback) => {
        callback(null, { stdout: 'Python 3.7.5\\n', stderr: '' });
        return undefined;
      });
      exec.mockImplementationOnce((_cmd, _options, _callback) => {
        throw new Error();
      });
    });
    it('returns found deps', async () => {
      exec.mockImplementationOnce((_cmd, _options, callback) => {
        callback(null, { stdout: jsonContent, stderr: '' });
        return undefined;
      });
      expect(
        await extractPackageFile(content, packageFile, config)
      ).toMatchSnapshot();
      expect(exec).toHaveBeenCalledTimes(4);
    });
    it('returns found deps (docker)', async () => {
      jest.resetAllMocks();
      jest.resetModules();
      extract.resetModule();

      // docker pull
      exec.mockImplementationOnce((cmd, _options, callback) => {
        callback(null, { stdout: '', stderr: '' });
        return undefined;
      });

      const execCommands = [];
      const execOptions = [];
      exec.mockImplementationOnce((cmd, options, callback) => {
        execCommands.push(cmd.replace(/\\/g, '/'));
        execOptions.push(cmd.replace(/\\/g, '/'));
        callback(null, { stdout: jsonContent, stderr: '' });
        return undefined;
      });

      expect(execCommands).toMatchSnapshot();
      expect(execOptions).toMatchSnapshot();
      expect(
        await extractPackageFile(content, packageFile, {
          ...config,
          binarySource: 'docker',
        })
      ).toMatchSnapshot();
      expect(exec).toHaveBeenCalledTimes(2);
    });
    it('should return null for invalid file', async () => {
      exec.mockImplementationOnce((_cmd, _options, _callback) => {
        throw new Error();
      });

      expect(
        await extractPackageFile('raise Exception()', await tmpFile(), config)
      ).toBeNull();
      expect(exec).toHaveBeenCalledTimes(4);
    });
    it('catches error', async () => {
      jest.resetAllMocks();
      jest.resetModules();
      extract.resetModule();
      exec.mockImplementation((_cmd, _options, _callback) => {
        throw new Error();
      });
      expect(
        await extractPackageFile('raise Exception()', await tmpFile(), config)
      ).toBeNull();
      expect(exec).toHaveBeenCalledTimes(4);
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

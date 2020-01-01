import { readFileSync } from 'fs';
import { exec as _exec } from 'child_process';
import * as extract from '../../../lib/manager/pip_setup/extract';
import { extractPackageFile } from '../../../lib/manager/pip_setup';

const packageFile = 'test/manager/pip_setup/_fixtures/setup.py';
const content = readFileSync(packageFile, 'utf8');

const packageFileJson = 'test/manager/pip_setup/_fixtures/setup.py.json';
const jsonContent = readFileSync(packageFileJson, 'utf8');

const config = {
  localDir: '/tmp/github/some/repo',
};

let processEnv;

const cleanCmd = (str: string) =>
  str
    .split(process.cwd())
    .join('/root/project')
    .replace(/\\(\w)/g, '/$1');

const exec: jest.Mock<typeof _exec> = _exec as any;
jest.mock('child_process');

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

      processEnv = process.env;
      process.env = {
        HTTP_PROXY: 'http://example.com',
        HTTPS_PROXY: 'https://example.com',
        NO_PROXY: 'localhost',
        HOME: '/home/user',
        PATH: '/tmp/path',
      };
    });
    afterEach(() => {
      process.env = processEnv;
    });
    it('returns found deps', async () => {
      const execCommands = [];
      const execOptions = [];
      exec.mockImplementationOnce((cmd, options, callback) => {
        execCommands.push(cleanCmd(cmd));
        execOptions.push(options);
        callback(null, { stdout: jsonContent, stderr: '' });
        return undefined;
      });
      expect(
        await extractPackageFile(content, packageFile, config)
      ).toMatchSnapshot();
      expect(exec).toHaveBeenCalledTimes(4);
      expect(execCommands).toMatchSnapshot();
      expect(execOptions).toMatchSnapshot();
    });
    it('returns found deps (docker)', async () => {
      jest.resetAllMocks();
      jest.resetModules();
      extract.resetModule();

      const execCommands = [];
      const execOptions = [];

      // docker pull
      exec.mockImplementationOnce((cmd, options, callback) => {
        execCommands.push(cleanCmd(cmd));
        execOptions.push(options);
        callback(null, { stdout: '', stderr: '' });
        return undefined;
      });

      exec.mockImplementationOnce((cmd, options, callback) => {
        execCommands.push(cleanCmd(cmd));
        execOptions.push(options);
        callback(null, { stdout: jsonContent, stderr: '' });
        return undefined;
      });

      expect(
        await extractPackageFile(content, packageFile, {
          ...config,
          binarySource: 'docker',
        })
      ).toMatchSnapshot();
      expect(exec).toHaveBeenCalledTimes(2);
      expect(execCommands).toMatchSnapshot();
      expect(execOptions).toMatchSnapshot();
    });
    it('should return null for invalid file', async () => {
      const execCommands = [];
      const execOptions = [];
      exec.mockImplementationOnce((cmd, options, _callback) => {
        execCommands.push(cleanCmd(cmd));
        execOptions.push(options);
        throw new Error();
      });

      expect(
        await extractPackageFile(
          'raise Exception()',
          '/tmp/folders/foobar.py',
          config
        )
      ).toBeNull();
      expect(exec).toHaveBeenCalledTimes(4);
      expect(execCommands).toMatchSnapshot();
      expect(execOptions).toMatchSnapshot();
    });
    it('catches error', async () => {
      const execCommands = [];
      const execOptions = [];
      jest.resetAllMocks();
      jest.resetModules();
      extract.resetModule();
      exec.mockImplementation((cmd, options, _callback) => {
        execCommands.push(cleanCmd(cmd));
        execOptions.push(options);
        throw new Error();
      });
      expect(
        await extractPackageFile(
          'raise Exception()',
          '/tmp/folders/foobar.py',
          config
        )
      ).toBeNull();
      expect(exec).toHaveBeenCalledTimes(4);
      expect(execCommands).toMatchSnapshot();
      expect(execOptions).toMatchSnapshot();
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

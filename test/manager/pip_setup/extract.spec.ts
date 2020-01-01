import { exec as _exec } from 'child_process';

import {
  resetModule,
  parsePythonVersion,
  getPythonAlias,
  pythonVersions,
} from '../../../lib/manager/pip_setup/extract';

const exec: jest.Mock<typeof _exec> = _exec as any;
jest.mock('child_process');

let processEnv;

describe('lib/manager/pip_setup/extract', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    resetModule();

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
  describe('parsePythonVersion', () => {
    it('returns major and minor version numbers', () => {
      expect(parsePythonVersion('Python 2.7.15rc1')).toEqual([2, 7]);
    });
  });
  describe('getPythonAlias', () => {
    it('returns the python alias to use', async () => {
      const execCommands = [];
      const execOptions = [];
      exec.mockImplementationOnce((cmd, options, callback) => {
        execCommands.push(cmd);
        execOptions.push(options);
        callback(null, { stdout: '', stderr: 'Python 2.7.17\\n' });
        return undefined;
      });
      exec.mockImplementationOnce((cmd, options, _callback) => {
        execCommands.push(cmd);
        execOptions.push(options);
        throw new Error();
      });
      exec.mockImplementationOnce((cmd, options, callback) => {
        execCommands.push(cmd);
        execOptions.push(options);
        callback(null, { stdout: 'Python 3.8.0\\n', stderr: '' });
        return undefined;
      });
      const result = await getPythonAlias();
      expect(pythonVersions.includes(result)).toBe(true);
      expect(result).toMatchSnapshot();
      expect(execCommands).toMatchSnapshot();
      expect(execOptions).toMatchSnapshot();
    });
  });
  // describe('Test for presence of mock lib', () => {
  //   it('should test if python mock lib is installed', async () => {
  //     const cp = jest.requireActual('../../../lib/util/exec');
  //     let isMockInstalled = true;
  //     // when binarysource === docker
  //     try {
  //       await cp.exec(`python -c "import mock"`);
  //     } catch (err) {
  //       isMockInstalled = false;
  //     }
  //     if (!isMockInstalled) {
  //       try {
  //         const pythonAlias = await getPythonAlias();
  //         await exec(`${pythonAlias} -c "from unittest import mock"`);
  //         isMockInstalled = true;
  //       } catch (err) {
  //         isMockInstalled = false;
  //       }
  //     }
  //     expect(isMockInstalled).toBe(true);
  //   });
  // });
});

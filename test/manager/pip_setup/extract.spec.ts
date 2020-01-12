import { exec as _exec } from 'child_process';

import {
  resetModule,
  parsePythonVersion,
  getPythonAlias,
  pythonVersions,
} from '../../../lib/manager/pip_setup/extract';
import { envMock, mockExecSequence } from '../../execUtil';
import * as _env from '../../../lib/util/exec/env';
import { mocked } from '../../util';

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

jest.mock('child_process');
jest.mock('../../../lib/util/exec/env');

describe('lib/manager/pip_setup/extract', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    resetModule();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  describe('parsePythonVersion', () => {
    it('returns major and minor version numbers', () => {
      expect(parsePythonVersion('Python 2.7.15rc1')).toEqual([2, 7]);
    });
  });
  describe('getPythonAlias', () => {
    it('returns the python alias to use', async () => {
      const execSnapshots = mockExecSequence(exec, [
        { stdout: '', stderr: 'Python 2.7.17\\n' },
        new Error(),
        { stdout: 'Python 3.8.0\\n', stderr: '' },
      ]);
      const result = await getPythonAlias();
      expect(pythonVersions.includes(result)).toBe(true);
      expect(result).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
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

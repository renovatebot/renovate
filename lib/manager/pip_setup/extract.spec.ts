import { exec as _exec } from 'child_process';

import { envMock, mockExecSequence } from '../../../test/execUtil';
import { mocked } from '../../../test/util';
import * as _env from '../../util/exec/env';
import {
  getPythonAlias,
  parsePythonVersion,
  pythonVersions,
  resetModule,
} from './extract';

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

jest.mock('child_process');
jest.mock('../../util/exec/env');

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
      expect(pythonVersions).toContain(result);
      expect(result).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });
  });
});

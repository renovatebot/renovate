import { exec } from '../../../lib/util/exec';

import {
  parsePythonVersion,
  getPythonAlias,
  pythonVersions,
} from '../../../lib/manager/pip_setup/extract';

describe('lib/manager/pip_setup/extract', () => {
  beforeEach(() => {
    jest.resetModules();
  });
  describe('parsePythonVersion', () => {
    it('returns major and minor version numbers', () => {
      expect(parsePythonVersion('Python 2.7.15rc1')).toEqual([2, 7]);
    });
  });
  describe('getPythonAlias', () => {
    it('returns the python alias to use', async () => {
      expect(pythonVersions.includes(await getPythonAlias())).toBe(true);
    });
    it('finds python', async () => {
      const fExec = jest.fn(() =>
        Promise.resolve({ stderr: 'Python 3.7.15rc1' })
      );
      jest.doMock('../../../lib/util/exec', () => {
        return {
          exec: fExec,
        };
      });
      const m = require('../../../lib/manager/pip_setup/extract');
      expect(pythonVersions.includes(await m.getPythonAlias())).toBe(true);
      expect(fExec).toMatchSnapshot();
    });
  });
  describe('Test for presence of mock lib', () => {
    it('should test if python mock lib is installed', async () => {
      const cp = jest.requireActual('../../../lib/util/exec');
      let isMockInstalled = true;
      // when binarysource === docker
      try {
        await cp.exec(`python -c "import mock"`);
      } catch (err) {
        isMockInstalled = false;
      }
      if (!isMockInstalled) {
        try {
          const pythonAlias = await getPythonAlias();
          await exec(`${pythonAlias} -c "from unittest import mock"`);
          isMockInstalled = true;
        } catch (err) {
          isMockInstalled = false;
        }
      }
      expect(isMockInstalled).toBe(true);
    });
  });
});

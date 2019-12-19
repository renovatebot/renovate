import { readFileSync } from 'fs';
import { file as _file } from 'tmp-promise';
import { relative } from 'path';
import { extractPackageFile } from '../../../lib/manager/pip_setup';

const packageFile = 'test/manager/pip_setup/_fixtures/setup.py';
const content = readFileSync(packageFile, 'utf8');
const config = {
  localDir: '.',
};

async function tmpFile() {
  const file = await _file({ postfix: '.py' });
  return relative('.', file.path);
}

describe('lib/manager/pip_setup/index', () => {
  beforeEach(() => {
    jest.resetModules();
  });
  describe('extractPackageFile()', () => {
    it('returns found deps', async () => {
      expect(
        await extractPackageFile(content, packageFile, config)
      ).toMatchSnapshot();
    });
    it('should return null for invalid file', async () => {
      expect(
        await extractPackageFile('raise Exception()', await tmpFile(), config)
      ).toBeNull();
    });
    it('should return null for no deps file', async () => {
      expect(
        await extractPackageFile(
          'from setuptools import setup\nsetup()',
          await tmpFile(),
          config
        )
      ).toBeNull();
    });
    it('catches error', async () => {
      const fExec = jest.fn(() => {
        throw new Error('No such file or directory');
      });
      jest.doMock('../../../lib/util/exec', () => {
        return {
          exec: fExec,
        };
      });
      const m = require('../../../lib/manager/pip_setup/extract');
      await m.extractPackageFile(content, packageFile, config);
      expect(fExec).toHaveBeenCalledTimes(4);
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

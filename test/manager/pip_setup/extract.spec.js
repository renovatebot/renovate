const fs = require('fs');
const { exec } = require('child-process-promise');
const tmp = require('tmp-promise');
const { relative } = require('path');
const {
  extractPackageFile,
  parsePythonVersion,
  getPythonAlias,
  pythonVersions,
  // extractSetupFile,
} = require('../../../lib/manager/pip_setup/extract');

const packageFile = 'test/manager/pip_setup/_fixtures/setup.py';
const content = fs.readFileSync(packageFile, 'utf8');
const config = {
  localDir: '.',
};

async function tmpFile() {
  const file = await tmp.file({ postfix: '.py' });
  return relative('.', file.path);
}

describe('lib/manager/pip_setup/extract', () => {
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
  });
  describe('Test for presence of mock lib', () => {
    it('should test if python mock lib is installed', async () => {
      let isMockInstalled = true;
      // when binarysource === docker
      try {
        await exec(`python -c "import mock"`);
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

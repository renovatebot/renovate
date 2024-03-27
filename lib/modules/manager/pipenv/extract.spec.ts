import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

const pipfile1 = Fixtures.get('Pipfile1');
const pipfile2 = Fixtures.get('Pipfile2');
const pipfile3 = Fixtures.get('Pipfile3');
const pipfile4 = Fixtures.get('Pipfile4');
const pipfile5 = Fixtures.get('Pipfile5');

describe('modules/manager/pipenv/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      expect(await extractPackageFile('[packages]\r\n', 'Pipfile')).toBeNull();
    });

    it('returns null for invalid toml file', async () => {
      expect(await extractPackageFile('nothing here', 'Pipfile')).toBeNull();
    });

    it('extracts dependencies', async () => {
      fs.localPathExists.mockResolvedValueOnce(true);
      const res = await extractPackageFile(pipfile1, 'Pipfile');
      expect(res).toMatchObject({
        deps: [
          {
            depType: 'packages',
            depName: 'some-package',
            currentValue: '==0.3.1',
            currentVersion: '0.3.1',
            datasource: 'pypi',
          },
          {
            depType: 'packages',
            depName: 'splinter',
            currentValue: '==3.43.1',
            currentVersion: '3.43.1',
            datasource: 'pypi',
          },
          {
            depType: 'packages',
            depName: 'requests',
            currentValue: '==1.1.1',
            currentVersion: '1.1.1',
            datasource: 'pypi',
          },
          {
            depType: 'packages',
            depName: 'some-other-package',
            currentValue: '==1.0.0',
            currentVersion: '1.0.0',
            datasource: 'pypi',
          },
          {
            depType: 'packages',
            depName: '_invalid-package',
            currentValue: '==1.0.0',
            skipReason: 'invalid-name',
          },
          {
            depType: 'packages',
            depName: 'invalid-version',
            currentValue: '==0 0',
            skipReason: 'invalid-version',
          },
          {
            depType: 'packages',
            depName: 'pytest-benchmark',
            currentValue: '==1.0.0',
            currentVersion: '1.0.0',
            datasource: 'pypi',
            managerData: {
              nestedVersion: true,
            },
          },
          {
            depType: 'dev-packages',
            depName: 'dev-package',
            currentValue: '==0.1.0',
            currentVersion: '0.1.0',
            datasource: 'pypi',
          },
        ],
        extractedConstraints: {
          python: '== 3.6.*',
        },
        lockFiles: ['Pipfile.lock'],
        registryUrls: [
          'https://pypi.org/simple',
          'http://example.com/private-pypi/',
        ],
      });

      expect(res?.deps.filter((dep) => !dep.skipReason)).toHaveLength(6);
    });

    it('marks packages with "extras" as skipReason === unspecified-version', async () => {
      const res = await extractPackageFile(pipfile3, 'Pipfile');
      expect(res?.deps.filter((r) => !r.skipReason)).toHaveLength(0);
      expect(res?.deps.filter((r) => r.skipReason)).toHaveLength(6);
    });

    it('extracts multiple dependencies', async () => {
      fs.localPathExists.mockResolvedValueOnce(true);
      const res = await extractPackageFile(pipfile2, 'Pipfile');
      expect(res).toMatchObject({
        deps: [
          {
            depType: 'packages',
            depName: 'Django',
            currentValue: '==1',
            currentVersion: '1',
            datasource: 'pypi',
          },
          {
            depType: 'packages',
            depName: 'distribute',
            currentValue: '==0.6.27',
            currentVersion: '0.6.27',
            datasource: 'pypi',
          },
          {
            depType: 'packages',
            depName: 'dj-database-url',
            currentValue: '==0.2',
            currentVersion: '0.2',
            datasource: 'pypi',
          },
          {
            depType: 'packages',
            depName: 'psycopg2',
            currentValue: '==2.4.5',
            currentVersion: '2.4.5',
            datasource: 'pypi',
          },
          {
            depType: 'packages',
            depName: 'wsgiref',
            currentValue: '==0.1.2',
            currentVersion: '0.1.2',
            datasource: 'pypi',
          },
        ],
        extractedConstraints: {
          python: '== 3.6.*',
        },
        lockFiles: ['Pipfile.lock'],
        registryUrls: ['https://pypi.org/simple'],
      });
    });

    it('ignores git dependencies', async () => {
      const content = codeBlock`
        [packages]
        flask = {git = "https://github.com/pallets/flask.git"}
        werkzeug = ">=0.14"
      `;
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.deps.filter((r) => !r.skipReason)).toHaveLength(1);
    });

    it('ignores invalid package names', async () => {
      const content = codeBlock`
        [packages]
        foo = "==1.0.0"
        _invalid = "==1.0.0"
      `;
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.deps).toHaveLength(2);
      expect(res?.deps.filter((dep) => !dep.skipReason)).toHaveLength(1);
    });

    it('ignores relative path dependencies', async () => {
      const content = codeBlock`
        [packages]
        foo = "==1.0.0"
        test = {path = "."}
      `;
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.deps.filter((r) => !r.skipReason)).toHaveLength(1);
    });

    it('ignores invalid versions', async () => {
      const content = codeBlock`
        [packages]
        foo = "==1.0.0"
        some-package = "==0 0"
      `;
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.deps).toHaveLength(2);
      expect(res?.deps.filter((dep) => !dep.skipReason)).toHaveLength(1);
    });

    it('extracts all sources', async () => {
      const content = codeBlock`
        [[source]]
        url = "source-url"
        [[source]]
        url = "other-source-url"
        [packages]
        foo = "==1.0.0"
      `;
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.registryUrls).toEqual(['source-url', 'other-source-url']);
    });

    it('extracts example pipfile', async () => {
      fs.localPathExists.mockResolvedValueOnce(true);
      const res = await extractPackageFile(pipfile4, 'Pipfile');
      expect(res).toMatchObject({
        deps: [
          {
            depType: 'packages',
            depName: 'requests',
            skipReason: 'unspecified-version',
          },
          {
            depType: 'packages',
            depName: 'records',
            currentValue: '>0.5.0',
            datasource: 'pypi',
          },
          {
            depType: 'packages',
            depName: 'django',
            skipReason: 'git-dependency',
          },
          {
            depType: 'packages',
            depName: 'e682b37',
            skipReason: 'file-dependency',
          },
          {
            depType: 'packages',
            depName: 'e1839a8',
            skipReason: 'local-dependency',
          },
          {
            depType: 'packages',
            depName: 'pywinusb',
            currentValue: '*',
            managerData: {
              nestedVersion: true,
            },
            registryUrls: ['https://pypi.python.org/simple'],
            skipReason: 'unspecified-version',
          },
          {
            depType: 'dev-packages',
            depName: 'nose',
            currentValue: '*',
            skipReason: 'unspecified-version',
          },
          {
            depType: 'dev-packages',
            depName: 'unittest2',
            currentValue: '>=1.0,<3.0',
            datasource: 'pypi',
            managerData: {
              nestedVersion: true,
            },
          },
        ],
        extractedConstraints: {
          python: '== 2.7.*',
        },
        lockFiles: ['Pipfile.lock'],
        registryUrls: ['https://pypi.python.org/simple'],
      });
    });

    it('supports custom index', async () => {
      fs.localPathExists.mockResolvedValueOnce(true);
      const res = await extractPackageFile(pipfile5, 'Pipfile');
      expect(res).toMatchObject({
        deps: [
          {
            depType: 'packages',
            depName: 'requests',
            currentValue: '==0.21.0',
            currentVersion: '0.21.0',
            datasource: 'pypi',
            managerData: {
              nestedVersion: true,
            },
            registryUrls: ['https://testpypi.python.org/pypi'],
          },
        ],
        lockFiles: ['Pipfile.lock'],
        registryUrls: [
          'https://pypi.python.org/simple',
          'https://testpypi.python.org/pypi',
        ],
      });
    });

    it('gets python constraint from python_version', async () => {
      const content = codeBlock`
        [packages]
        foo = "==1.0.0"
        [requires]
        python_version = "3.8"
      `;
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.extractedConstraints?.python).toBe('== 3.8.*');
    });

    it('gets python constraint from python_full_version', async () => {
      const content = codeBlock`
        [packages]
        foo = "==1.0.0"
        [requires]
        python_full_version = "3.8.6"
      `;
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.extractedConstraints?.python).toBe('== 3.8.6');
    });

    it('gets pipenv constraint from packages', async () => {
      const content = codeBlock`
        [packages]
        pipenv = "==2020.8.13"
      `;
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.extractedConstraints?.pipenv).toBe('==2020.8.13');
    });

    it('gets pipenv constraint from dev-packages', async () => {
      const content = codeBlock`
        [dev-packages]
        pipenv = "==2020.8.13"
      `;
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.extractedConstraints?.pipenv).toBe('==2020.8.13');
    });
  });
});

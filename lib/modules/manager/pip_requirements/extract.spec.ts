import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { extractPackageFile } from './index.ts';

const requirements1 = Fixtures.get('requirements1.txt');
const requirements2 = Fixtures.get('requirements2.txt');
const requirements3 = Fixtures.get('requirements3.txt');
const requirements4 = Fixtures.get('requirements4.txt');
const requirements5 = Fixtures.get('requirements5.txt');
const requirements6 = Fixtures.get('requirements6.txt');
const requirements7 = Fixtures.get('requirements7.txt');
const requirements8 = Fixtures.get('requirements8.txt');
const requirementsWithEnvMarkers = Fixtures.get('requirements-env-markers.txt');
const requirementsGitPackages = Fixtures.get('requirements-git-packages.txt');

describe('modules/manager/pip_requirements/extract', () => {
  beforeEach(() => {
    delete process.env.PIP_TEST_TOKEN;
    GlobalConfig.reset();
  });

  afterEach(() => {
    delete process.env.PIP_TEST_TOKEN;
    GlobalConfig.reset();
  });

  describe('extractPackageFile()', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = { ...OLD_ENV };
      delete process.env.PIP_INDEX_URL;
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts dependencies', () => {
      const res = extractPackageFile(requirements1);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '==0.3.1',
            currentVersion: '0.3.1',
            datasource: 'pypi',
            depName: 'some-package',
            packageName: 'some-package',
          },
          {
            currentValue: '==1.0.0',
            currentVersion: '1.0.0',
            datasource: 'pypi',
            depName: 'some-other-package',
            packageName: 'some-other-package',
          },
          {
            currentValue: undefined,
            datasource: 'pypi',
            depName: 'sphinx',
            packageName: 'sphinx',
          },
          {
            currentValue: '==1.9',
            currentVersion: '1.9',
            datasource: 'pypi',
            depName: 'not_semver',
            packageName: 'not-semver',
          },
        ],
        registryUrls: ['http://example.com/private-pypi/'],
      });
      expect(res?.registryUrls).toEqual(['http://example.com/private-pypi/']);
      expect(res?.deps).toHaveLength(4);
    });

    it('extracts dependencies with --index-url short code', () => {
      const requirements = codeBlock`
        -i http://example.com/private-pypi/
        some-package==0.3.1
      `;

      const res = extractPackageFile(requirements);

      expect(res).toMatchObject({
        deps: [
          {
            currentValue: '==0.3.1',
            currentVersion: '0.3.1',
            datasource: 'pypi',
            depName: 'some-package',
          },
        ],
      });
    });

    it('extracts --requirement short code option', () => {
      const requirements = codeBlock`
        -r base.txt
        some-package==0.3.1
      `;

      const res = extractPackageFile(requirements);

      expect(res).toHaveProperty('managerData', {
        requirementsFiles: ['base.txt'],
      });
    });

    it('extracts --constraints short code option', () => {
      const requirements = codeBlock`
        -c constrain.txt
        some-package==0.3.1
      `;

      const res = extractPackageFile(requirements);

      expect(res).toHaveProperty('managerData', {
        constraintsFiles: ['constrain.txt'],
      });
    });

    it('extracts multiple dependencies', () => {
      const res = extractPackageFile(requirements2)?.deps;
      expect(res).toEqual([
        {
          currentValue: '==1',
          currentVersion: '1',
          datasource: 'pypi',
          depName: 'Django',
          packageName: 'django',
        },
        {
          currentValue: '==0.6.27',
          currentVersion: '0.6.27',
          datasource: 'pypi',
          depName: 'distribute',
          packageName: 'distribute',
        },
        {
          currentValue: '==0.2',
          currentVersion: '0.2',
          datasource: 'pypi',
          depName: 'dj-database-url',
          packageName: 'dj-database-url',
        },
        {
          currentValue: '==2.4.5',
          currentVersion: '2.4.5',
          datasource: 'pypi',
          depName: 'psycopg2',
          packageName: 'psycopg2',
        },
        {
          currentValue: '==0.1.2',
          currentVersion: '0.1.2',
          datasource: 'pypi',
          depName: 'wsgiref',
          packageName: 'wsgiref',
        },
      ]);
      expect(res).toHaveLength(5);
    });

    it('handles comments and commands', () => {
      const res = extractPackageFile(requirements3)?.deps;
      expect(res).toEqual([
        {
          currentValue: '==1.11.23',
          currentVersion: '1.11.23',
          datasource: 'pypi',
          depName: 'Django',
          packageName: 'django',
        },
        {
          currentValue: '==0.6.27',
          currentVersion: '0.6.27',
          datasource: 'pypi',
          depName: 'distribute',
          packageName: 'distribute',
          skipReason: 'ignored',
        },
        {
          currentValue: '==0.2',
          currentVersion: '0.2',
          datasource: 'pypi',
          depName: 'dj-database-url',
          packageName: 'dj-database-url',
        },
        {
          currentValue: '==2.4.5',
          currentVersion: '2.4.5',
          datasource: 'pypi',
          depName: 'psycopg2',
          packageName: 'psycopg2',
        },
        {
          currentValue: '==0.1.2',
          currentVersion: '0.1.2',
          datasource: 'pypi',
          depName: 'wsgiref',
          packageName: 'wsgiref',
        },
      ]);
      expect(res).toHaveLength(5);
    });

    it('handles extras and complex index url', () => {
      const res = extractPackageFile(requirements4);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '==2.0.12',
            currentVersion: '2.0.12',
            datasource: 'pypi',
            depName: 'Django',
            packageName: 'django',
          },
          {
            currentValue: '==4.1.1',
            currentVersion: '4.1.1',
            datasource: 'pypi',
            depName: 'celery',
            packageName: 'celery',
          },
          {
            currentValue: '== 3.2.1',
            currentVersion: '3.2.1',
            datasource: 'pypi',
            depName: 'foo',
            packageName: 'foo',
          },
        ],
        registryUrls: [
          'https://artifactory.company.com/artifactory/api/pypi/python/simple',
        ],
      });
      expect(res?.registryUrls).toEqual([
        'https://artifactory.company.com/artifactory/api/pypi/python/simple',
      ]);
      expect(res?.deps).toHaveLength(3);
    });

    it('handles extra index url', () => {
      const res = extractPackageFile(requirements5);
      expect(res).toEqual({
        additionalRegistryUrls: ['http://example.com/private-pypi/'],
        deps: [
          {
            currentValue: '==2.0.12',
            currentVersion: '2.0.12',
            datasource: 'pypi',
            depName: 'Django',
            packageName: 'django',
          },
          {
            currentValue: '==4.1.1',
            currentVersion: '4.1.1',
            datasource: 'pypi',
            depName: 'celery',
            packageName: 'celery',
          },
          {
            currentValue: '== 3.2.1',
            currentVersion: '3.2.1',
            datasource: 'pypi',
            depName: 'foo',
            packageName: 'foo',
          },
          {
            currentValue: '==0.3.1',
            currentVersion: '0.3.1',
            datasource: 'pypi',
            depName: 'some-package',
            packageName: 'some-package',
          },
          {
            currentValue: '==1.0.0',
            currentVersion: '1.0.0',
            datasource: 'pypi',
            depName: 'some-other-package',
            packageName: 'some-other-package',
          },
          {
            currentValue: '==1.9',
            currentVersion: '1.9',
            datasource: 'pypi',
            depName: 'not_semver',
            packageName: 'not-semver',
          },
        ],
        registryUrls: [
          'https://artifactory.company.com/artifactory/api/pypi/python/simple',
        ],
      });
      expect(res?.registryUrls).toEqual([
        'https://artifactory.company.com/artifactory/api/pypi/python/simple',
      ]);
      expect(res?.additionalRegistryUrls).toEqual([
        'http://example.com/private-pypi/',
      ]);
      expect(res?.deps).toHaveLength(6);
    });

    it('handles extra index url and defaults without index to config', () => {
      const res = extractPackageFile(requirements6);
      expect(res).toEqual({
        additionalRegistryUrls: ['http://example.com/private-pypi/'],
        deps: [
          {
            currentValue: '==2.0.12',
            currentVersion: '2.0.12',
            datasource: 'pypi',
            depName: 'Django',
            packageName: 'django',
          },
          {
            currentValue: '==4.1.1',
            currentVersion: '4.1.1',
            datasource: 'pypi',
            depName: 'celery',
            packageName: 'celery',
          },
          {
            currentValue: '== 3.2.1',
            currentVersion: '3.2.1',
            datasource: 'pypi',
            depName: 'foo',
            packageName: 'foo',
          },
          {
            currentValue: '==0.3.1',
            currentVersion: '0.3.1',
            datasource: 'pypi',
            depName: 'some-package',
            packageName: 'some-package',
          },
          {
            currentValue: '==1.0.0',
            currentVersion: '1.0.0',
            datasource: 'pypi',
            depName: 'some-other-package',
            packageName: 'some-other-package',
          },
          {
            currentValue: '==1.9',
            currentVersion: '1.9',
            datasource: 'pypi',
            depName: 'not_semver',
            packageName: 'not-semver',
          },
        ],
      });
      expect(res?.additionalRegistryUrls).toEqual([
        'http://example.com/private-pypi/',
      ]);
      expect(res?.deps).toHaveLength(6);
    });

    it('handles extra index url and defaults without index to pypi', () => {
      const res = extractPackageFile(requirements6);
      expect(res).toEqual({
        additionalRegistryUrls: ['http://example.com/private-pypi/'],
        deps: [
          {
            currentValue: '==2.0.12',
            currentVersion: '2.0.12',
            datasource: 'pypi',
            depName: 'Django',
            packageName: 'django',
          },
          {
            currentValue: '==4.1.1',
            currentVersion: '4.1.1',
            datasource: 'pypi',
            depName: 'celery',
            packageName: 'celery',
          },
          {
            currentValue: '== 3.2.1',
            currentVersion: '3.2.1',
            datasource: 'pypi',
            depName: 'foo',
            packageName: 'foo',
          },
          {
            currentValue: '==0.3.1',
            currentVersion: '0.3.1',
            datasource: 'pypi',
            depName: 'some-package',
            packageName: 'some-package',
          },
          {
            currentValue: '==1.0.0',
            currentVersion: '1.0.0',
            datasource: 'pypi',
            depName: 'some-other-package',
            packageName: 'some-other-package',
          },
          {
            currentValue: '==1.9',
            currentVersion: '1.9',
            datasource: 'pypi',
            depName: 'not_semver',
            packageName: 'not-semver',
          },
        ],
      });
      expect(res?.additionalRegistryUrls).toEqual([
        'http://example.com/private-pypi/',
      ]);
      expect(res?.deps).toHaveLength(6);
    });

    it('handles extra spaces around pinned dependency equal signs', () => {
      const res = extractPackageFile(requirements4);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '==2.0.12',
            currentVersion: '2.0.12',
            datasource: 'pypi',
            depName: 'Django',
            packageName: 'django',
          },
          {
            currentValue: '==4.1.1',
            currentVersion: '4.1.1',
            datasource: 'pypi',
            depName: 'celery',
            packageName: 'celery',
          },
          {
            currentValue: '== 3.2.1',
            currentVersion: '3.2.1',
            datasource: 'pypi',
            depName: 'foo',
            packageName: 'foo',
          },
        ],
        registryUrls: [
          'https://artifactory.company.com/artifactory/api/pypi/python/simple',
        ],
      });

      expect(res?.deps[0].currentValue).toStartWith('==');
      expect(res?.deps[0].currentVersion).toStartWith('2.0.12');
      expect(res?.deps[1].currentValue).toStartWith('==');
      expect(res?.deps[1].currentVersion).toStartWith('4.1.1');
      expect(res?.deps[2].currentValue).toStartWith('==');
      expect(res?.deps[2].currentVersion).toStartWith('3.2.1');

      expect(res?.deps).toHaveLength(3);
    });

    it('should not replace env vars in low trust mode', () => {
      process.env.PIP_TEST_TOKEN = 'its-a-secret';
      const res = extractPackageFile(requirements7);
      expect(res?.additionalRegistryUrls).toEqual([
        'http://$PIP_TEST_TOKEN:example.com/private-pypi/',
        'http://${PIP_TEST_TOKEN}:example.com/private-pypi/',
        'http://$PIP_TEST_TOKEN:example.com/private-pypi/',
        'http://${PIP_TEST_TOKEN1}:example.com/private-pypi/',
      ]);
    });

    it('should replace env vars in high trust mode', () => {
      process.env.PIP_TEST_TOKEN = 'its-a-secret';
      GlobalConfig.set({ exposeAllEnv: true });
      const res = extractPackageFile(requirements7);
      expect(res?.additionalRegistryUrls).toEqual([
        'http://its-a-secret:example.com/private-pypi/',
        'http://its-a-secret:example.com/private-pypi/',
        'http://its-a-secret:example.com/private-pypi/',
        'http://${PIP_TEST_TOKEN1}:example.com/private-pypi/',
      ]);
    });

    it('should handle hashes', () => {
      const res = extractPackageFile(requirements8);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '==1.9.1',
            currentVersion: '1.9.1',
            datasource: 'pypi',
            depName: 'Django',
            packageName: 'django',
          },
          {
            currentValue: '==0.22.1',
            currentVersion: '0.22.1',
            datasource: 'pypi',
            depName: 'bgg',
            packageName: 'bgg',
          },
          {
            currentValue: '==2016.1.8',
            currentVersion: '2016.1.8',
            datasource: 'pypi',
            depName: 'html2text',
            packageName: 'html2text',
          },
        ],
      });
      expect(res?.deps).toHaveLength(3);
    });

    it('should handle package with extras and no version specifiers', () => {
      const res = extractPackageFile('Django[argon2]');
      expect(res).toMatchObject({
        deps: [
          {
            currentValue: undefined,
            datasource: 'pypi',
            depName: 'Django',
            packageName: 'django',
          },
        ],
      });
    });

    it('should handle dependency and ignore env markers', () => {
      const res = extractPackageFile(requirementsWithEnvMarkers);
      expect(res).toEqual({
        deps: [
          {
            currentValue: '==20.3.0',
            currentVersion: '20.3.0',
            datasource: 'pypi',
            depName: 'attrs',
            packageName: 'attrs',
          },
        ],
      });
    });

    it('should handle git packages', () => {
      const res = extractPackageFile(requirementsGitPackages);
      expect(res?.deps).toHaveLength(5);
      expect(res).toEqual({
        deps: [
          {
            depName: 'python-pip-setup-test',
            currentValue: 'v1.1.0',
            currentVersion: 'v1.1.0',
            packageName: 'git@github.com:rwxd/python-pip-setup-test.git',
            datasource: 'git-tags',
          },
          {
            depName: 'test_package',
            currentValue: '1.0.0',
            currentVersion: '1.0.0',
            packageName: 'git@github.com:rwxd/test_package',
            datasource: 'git-tags',
          },
          {
            depName: 'python-package',
            currentValue: 'abcde',
            currentVersion: 'abcde',
            packageName: 'git@gitlab.company.com:rwxd/python-package.git',
            datasource: 'git-tags',
          },
          {
            depName: 'python-pip-setup-test',
            currentValue: 'v0.9.0',
            currentVersion: 'v0.9.0',
            packageName:
              'https://peter@github.com/rwxd/python-pip-setup-test.git',
            datasource: 'git-tags',
          },
          {
            depName: 'python-pip-setup-test',
            currentValue: 'v0.9.0',
            currentVersion: 'v0.9.0',
            packageName: 'https://github.com/rwxd/python-pip-setup-test.git',
            datasource: 'git-tags',
          },
        ],
      });
    });

    it('extracts a file with only --index-url flags', () => {
      const res = extractPackageFile('--index-url https://example.com/pypi');
      expect(res).toMatchObject({
        deps: [],
        registryUrls: ['https://example.com/pypi'],
      });
    });

    it('extracts a file with only --extra-index-url flags', () => {
      const res = extractPackageFile(
        '--extra-index-url https://example.com/pypi',
      );
      expect(res).toMatchObject({
        deps: [],
        additionalRegistryUrls: ['https://example.com/pypi'],
      });
    });

    it('extracts a file with only -r flags', () => {
      const res = extractPackageFile('-r requirements-other.txt');
      expect(res).toMatchObject({
        deps: [],
        managerData: {
          requirementsFiles: ['requirements-other.txt'],
        },
      });
    });

    it('extracts a file with only -c flags', () => {
      const res = extractPackageFile('-c constraints.txt');
      expect(res).toMatchObject({
        deps: [],
        managerData: {
          constraintsFiles: ['constraints.txt'],
        },
      });
    });
  });
});

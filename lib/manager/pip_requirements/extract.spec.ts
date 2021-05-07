import { getName, loadFixture } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import { extractPackageFile } from './extract';

const requirements1 = loadFixture('requirements1.txt');
const requirements2 = loadFixture('requirements2.txt');
const requirements3 = loadFixture('requirements3.txt');
const requirements4 = loadFixture('requirements4.txt');
const requirements5 = loadFixture('requirements5.txt');
const requirements6 = loadFixture('requirements6.txt');
const requirements7 = loadFixture('requirements7.txt');
const requirements8 = loadFixture('requirements8.txt');

describe(getName(), () => {
  beforeEach(() => {
    delete process.env.PIP_TEST_TOKEN;
    setAdminConfig();
  });
  afterEach(() => {
    delete process.env.PIP_TEST_TOKEN;
    setAdminConfig();
  });
  describe('extractPackageFile()', () => {
    let config;
    const OLD_ENV = process.env;
    beforeEach(() => {
      config = { registryUrls: ['AnExistingDefaultUrl'] };
      process.env = { ...OLD_ENV };
      delete process.env.PIP_INDEX_URL;
    });
    afterEach(() => {
      process.env = OLD_ENV;
    });
    it('returns null for empty', () => {
      expect(
        extractPackageFile('nothing here', 'requirements.txt', config)
      ).toBeNull();
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile(requirements1, 'unused_file_name', config);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual(['http://example.com/private-pypi/']);
      expect(res.deps).toHaveLength(3);
    });
    it('extracts multiple dependencies', () => {
      const res = extractPackageFile(requirements2, 'unused_file_name', config)
        .deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(5);
    });
    it('handles comments and commands', () => {
      const res = extractPackageFile(requirements3, 'unused_file_name', config)
        .deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(5);
    });
    it('handles extras and complex index url', () => {
      const res = extractPackageFile(requirements4, 'unused_file_name', config);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual([
        'https://artifactory.company.com/artifactory/api/pypi/python/simple',
      ]);
      expect(res.deps).toHaveLength(3);
    });
    it('handles extra index url', () => {
      const res = extractPackageFile(requirements5, 'unused_file_name', config);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual([
        'https://artifactory.company.com/artifactory/api/pypi/python/simple',
        'http://example.com/private-pypi/',
      ]);
      expect(res.deps).toHaveLength(6);
    });
    it('handles extra index url and defaults without index to config', () => {
      const res = extractPackageFile(requirements6, 'unused_file_name', config);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual([
        'AnExistingDefaultUrl',
        'http://example.com/private-pypi/',
      ]);
      expect(res.deps).toHaveLength(6);
    });
    it('handles extra index url and defaults without index to pypi', () => {
      const res = extractPackageFile(requirements6, 'unused_file_name', {});
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual([
        'https://pypi.org/pypi/',
        'http://example.com/private-pypi/',
      ]);
      expect(res.deps).toHaveLength(6);
    });

    it('handles extra spaces around pinned dependency equal signs', () => {
      const res = extractPackageFile(requirements8, 'unused_file_name', {});
      expect(res).toMatchSnapshot();

      expect(res.deps[0].currentValue).toStartWith('==');
      expect(res.deps[1].currentValue).toStartWith('==');
      expect(res.deps[2].currentValue).toStartWith('==');

      expect(res.deps).toHaveLength(3);
    });
    it('should not replace env vars in low trust mode', () => {
      process.env.PIP_TEST_TOKEN = 'its-a-secret';
      const res = extractPackageFile(requirements7, 'unused_file_name', {});
      expect(res.registryUrls).toEqual([
        'https://pypi.org/pypi/',
        'http://$PIP_TEST_TOKEN:example.com/private-pypi/',
        // eslint-disable-next-line no-template-curly-in-string
        'http://${PIP_TEST_TOKEN}:example.com/private-pypi/',
        'http://$PIP_TEST_TOKEN:example.com/private-pypi/',
        // eslint-disable-next-line no-template-curly-in-string
        'http://${PIP_TEST_TOKEN}:example.com/private-pypi/',
      ]);
    });
    it('should replace env vars in high trust mode', () => {
      process.env.PIP_TEST_TOKEN = 'its-a-secret';
      setAdminConfig({ exposeAllEnv: true });
      const res = extractPackageFile(requirements7, 'unused_file_name', {});
      expect(res.registryUrls).toEqual([
        'https://pypi.org/pypi/',
        'http://its-a-secret:example.com/private-pypi/',
        'http://its-a-secret:example.com/private-pypi/',
        'http://its-a-secret:example.com/private-pypi/',
        'http://its-a-secret:example.com/private-pypi/',
      ]);
    });
  });
});

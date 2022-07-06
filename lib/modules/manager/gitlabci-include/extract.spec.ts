import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import { extractPackageFile } from '.';

const yamlFileMultiConfig = Fixtures.get('gitlab-ci.1.yaml');
const yamlFileSingleConfig = Fixtures.get('gitlab-ci.2.yaml');
const yamlWithEmptyIncludeConfig = Fixtures.get('gitlab-ci.3.yaml');

describe('modules/manager/gitlabci-include/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('returns null for include block without any actual includes', () => {
      const res = extractPackageFile(yamlWithEmptyIncludeConfig);
      expect(res).toBeNull();
    });

    it('extracts single include block', () => {
      const res = extractPackageFile(yamlFileSingleConfig);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(1);
    });

    it('extracts multiple include blocks', () => {
      const res = extractPackageFile(yamlFileMultiConfig);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
    });

    it('normalizes configured endpoints', () => {
      const endpoints = [
        'http://gitlab.test/api/v4',
        'http://gitlab.test/api/v4/',
      ];

      for (const endpoint of endpoints) {
        GlobalConfig.set({ platform: 'gitlab', endpoint });
        const res = extractPackageFile(yamlFileMultiConfig);
        expect(res?.deps[0].registryUrls).toEqual(['http://gitlab.test']);
      }
    });
  });
});

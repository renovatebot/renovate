import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import { extractPackageFile } from '.';

const yamlFileMultiConfig = Fixtures.get('gitlab-ci.1.yaml');
const yamlFileSingleConfig = Fixtures.get('gitlab-ci.2.yaml');
const yamlWithEmptyIncludeConfig = Fixtures.get('gitlab-ci.3.yaml');
const yamlWithTriggerRef = Fixtures.get('gitlab-ci.4.yaml');

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

    it('extracts multiple embedded include blocks', () => {
      const res = extractPackageFile(yamlWithTriggerRef);
      expect(res?.deps).toHaveLength(2);
      expect(res?.deps).toMatchObject([
        {
          currentValue: 'master',
          datasource: 'gitlab-tags',
          depName: 'mikebryant/include-source-example',
        },
        {
          currentValue: '1.0.0',
          datasource: 'gitlab-tags',
          depName: 'mikebryant/include-source-example',
        },
      ]);
    });

    it('ignores includes without project and file keys', () => {
      const includeWithoutProjectRef = `include:
      - 'https://gitlab.com/mikebryant/include-source-example.yml'
      - remote: 'https://gitlab.com/mikebryant/include-source-example.yml'
      - local: mikebryant/include-source-example`;
      const res = extractPackageFile(includeWithoutProjectRef);
      expect(res).toBeNull();
    });

    it('extracts component references', () => {
      GlobalConfig.set({
        endpoint: 'https://gitlab.example.com',
      });

      const includeWithoutProjectRef = `include:
        - component: gitlab.example.com/an-org/a-project/a-component@1.0
          inputs:
            stage: build
        - component: gitlab.example.com/an-org/a-subgroup/a-project/a-component@e3262fdd0914fa823210cdb79a8c421e2cef79d8
        - component: gitlab.example.com/an-org/a-subgroup/another-project/a-component@main
        - component: gitlab.example.com/another-org/a-project/a-component@~latest
          inputs:
            stage: test
        - component: gitlab.example.com/malformed-component-reference
        - component:
            malformed: true
        - component: gitlab.example.com/an-org/a-component@1.0
        - component: other-gitlab.example.com/an-org/a-project/a-component@1.0`;
      const res = extractPackageFile(includeWithoutProjectRef);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(5);
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

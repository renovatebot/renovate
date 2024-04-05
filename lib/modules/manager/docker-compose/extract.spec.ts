import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const yamlFile1 = Fixtures.get('docker-compose.1.yml');
const yamlFile3 = Fixtures.get('docker-compose.3.yml');
const yamlFile3NoVersion = Fixtures.get('docker-compose.3-no-version.yml');
const yamlFile3DefaultValue = Fixtures.get('docker-compose.3-default-val.yml');

describe('modules/manager/docker-compose/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('', '', {})).toBeNull();
    });

    it('returns null for non-object YAML', () => {
      expect(extractPackageFile('nothing here', '', {})).toBeNull();
    });

    it('returns null for malformed YAML', () => {
      expect(extractPackageFile('nothing here\n:::::::', '', {})).toBeNull();
    });

    it('extracts multiple image lines for version 1', () => {
      const res = extractPackageFile(yamlFile1, '', {});
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(8);
    });

    it('extracts multiple image lines for version 3', () => {
      const res = extractPackageFile(yamlFile3, '', {});
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(8);
    });

    it('extracts multiple image lines for version 3 without set version key', () => {
      const res = extractPackageFile(yamlFile3NoVersion, '', {});
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(8);
    });

    it('extracts default variable values for version 3', () => {
      const res = extractPackageFile(yamlFile3DefaultValue, '', {});
      expect(res?.deps).toMatchInlineSnapshot(`
        [
          {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:abcd",
            "currentValue": "5.0.0",
            "datasource": "docker",
            "depName": "redis",
            "replaceString": "redis:5.0.0@sha256:abcd",
          },
        ]
      `);
      expect(res?.deps).toHaveLength(1);
    });

    it('extracts image and replaces registry', () => {
      const res = extractPackageFile(
        `
    version: "3"
    services:
      nginx:
        image: quay.io/nginx:0.0.1
      `,
        '',
        {
          registryAliases: {
            'quay.io': 'my-quay-mirror.registry.com',
          },
        },
      );
      expect(res).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              'quay.io/nginx:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'my-quay-mirror.registry.com/nginx',
            replaceString: 'quay.io/nginx:0.0.1',
          },
        ],
      });
    });

    it('extracts image but no replacement', () => {
      const res = extractPackageFile(
        `
        version: "3"
        services:
          nginx:
            image: quay.io/nginx:0.0.1
        `,
        '',
        {
          registryAliases: {
            'index.docker.io': 'my-docker-mirror.registry.com',
          },
        },
      );
      expect(res).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'quay.io/nginx',
            replaceString: 'quay.io/nginx:0.0.1',
          },
        ],
      });
    });

    it('extracts image and no double replacement', () => {
      const res = extractPackageFile(
        `
        version: "3"
        services:
          nginx:
            image: quay.io/nginx:0.0.1
        `,
        '',
        {
          registryAliases: {
            'quay.io': 'my-quay-mirror.registry.com',
            'my-quay-mirror.registry.com': 'quay.io',
          },
        },
      );
      expect(res).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              'quay.io/nginx:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'my-quay-mirror.registry.com/nginx',
            replaceString: 'quay.io/nginx:0.0.1',
          },
        ],
      });
    });
  });
});

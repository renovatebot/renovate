import { Fixtures } from '../../../../test/fixtures';
import * as expectedDeps from './__fixtures__/deps.json';
import { extractPackageFile } from '.';

const yamlFile = Fixtures.get('.woodpecker.yml');

describe('modules/manager/woodpecker/extract', () => {
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

    it('extracts multiple image lines', () => {
      const res = extractPackageFile(yamlFile, '', {});
      expect(res?.deps).toEqual(expectedDeps.deps);
      expect(res?.deps).toHaveLength(8);
    });

    it('extracts image and replaces registry', () => {
      const res = extractPackageFile(
        `
    pipeline:
      nginx:
        image: quay.io/nginx:0.0.1
      `,
        '',
        {
          registryAliases: {
            'quay.io': 'my-quay-mirror.registry.com',
          },
        }
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
        pipeline:
          nginx:
            image: quay.io/nginx:0.0.1
        `,
        '',
        {
          registryAliases: {
            'index.docker.io': 'my-docker-mirror.registry.com',
          },
        }
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
        pipeline:
          nginx:
            image: quay.io/nginx:0.0.1
        `,
        '',
        {
          registryAliases: {
            'quay.io': 'my-quay-mirror.registry.com',
            'my-quay-mirror.registry.com': 'quay.io',
          },
        }
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

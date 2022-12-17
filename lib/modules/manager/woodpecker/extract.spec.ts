import { Fixtures } from '../../../../test/fixtures';
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
      expect(res).toEqual({
        deps: [
          {
            depName: 'quay.io/something/redis',
            currentValue: 'alpine',
            currentDigest: undefined,
            replaceString: 'quay.io/something/redis:alpine',
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            datasource: 'docker',
          },
          {
            depName: 'node',
            currentValue: '10.0.0',
            currentDigest: undefined,
            replaceString: 'node:10.0.0',
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            datasource: 'docker',
          },
          {
            depName: 'postgres',
            currentValue: '9.4.0',
            currentDigest: undefined,
            replaceString: 'postgres:9.4.0',
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            datasource: 'docker',
          },
          {
            depName: 'dockersamples/examplevotingapp_vote',
            currentValue: 'before',
            currentDigest: undefined,
            replaceString: 'dockersamples/examplevotingapp_vote:before',
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            datasource: 'docker',
          },
          {
            depName: 'dockersamples/examplevotingapp_result',
            currentValue: 'before',
            currentDigest: undefined,
            replaceString: 'dockersamples/examplevotingapp_result:before',
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            datasource: 'docker',
          },
          {
            depName: 'dockersamples/examplevotingapp_worker',
            currentValue: undefined,
            currentDigest: undefined,
            replaceString: 'dockersamples/examplevotingapp_worker',
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            datasource: 'docker',
          },
          {
            depName: 'dockersamples/visualizer',
            currentValue: 'stable',
            currentDigest: undefined,
            replaceString: 'dockersamples/visualizer:stable',
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            datasource: 'docker',
          },
          {
            depName: 'app-local-debug',
            currentValue: undefined,
            currentDigest: undefined,
            replaceString: 'app-local-debug',
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            datasource: 'docker',
          },
        ],
      });
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

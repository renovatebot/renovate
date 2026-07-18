import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

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
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'alpine',
          datasource: 'docker',
          depName: 'quay.io/something/redis',
          packageName: 'quay.io/something/redis',
          replaceString: 'quay.io/something/redis:alpine',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '10.0.0',
          datasource: 'docker',
          depName: 'node',
          packageName: 'node',
          replaceString: 'node:10.0.0',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '9.4.0',
          datasource: 'docker',
          depName: 'postgres',
          packageName: 'postgres',
          replaceString: 'postgres:9.4.0',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'before',
          datasource: 'docker',
          depName: 'dockersamples/examplevotingapp_vote',
          packageName: 'dockersamples/examplevotingapp_vote',
          replaceString: 'dockersamples/examplevotingapp_vote:before',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'before',
          datasource: 'docker',
          depName: 'dockersamples/examplevotingapp_result',
          packageName: 'dockersamples/examplevotingapp_result',
          replaceString: 'dockersamples/examplevotingapp_result:before',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'dockersamples/examplevotingapp_worker',
          packageName: 'dockersamples/examplevotingapp_worker',
          replaceString: 'dockersamples/examplevotingapp_worker',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'stable',
          datasource: 'docker',
          depName: 'dockersamples/visualizer',
          packageName: 'dockersamples/visualizer',
          replaceString: 'dockersamples/visualizer:stable',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          datasource: 'docker',
          replaceString: '${IMAGE:-synkodevelopers/edplugins}:${TAG:-latest}',
          skipReason: 'contains-variable',
        },
      ]);
      expect(res?.deps).toHaveLength(8);
    });

    it('extracts multiple image lines for version 3', () => {
      const res = extractPackageFile(yamlFile3, '', {});
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'alpine',
          datasource: 'docker',
          depName: 'quay.io/something/redis',
          packageName: 'quay.io/something/redis',
          replaceString: 'quay.io/something/redis:alpine',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '10.0.0',
          datasource: 'docker',
          depName: 'node',
          packageName: 'node',
          replaceString: 'node:10.0.0',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '9.4.0',
          datasource: 'docker',
          depName: 'postgres',
          packageName: 'postgres',
          replaceString: 'postgres:9.4.0',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'before',
          datasource: 'docker',
          depName: 'dockersamples/examplevotingapp_vote',
          packageName: 'dockersamples/examplevotingapp_vote',
          replaceString: 'dockersamples/examplevotingapp_vote:before',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'before',
          datasource: 'docker',
          depName: 'dockersamples/examplevotingapp_result',
          packageName: 'dockersamples/examplevotingapp_result',
          replaceString: 'dockersamples/examplevotingapp_result:before',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'dockersamples/examplevotingapp_worker',
          packageName: 'dockersamples/examplevotingapp_worker',
          replaceString: 'dockersamples/examplevotingapp_worker',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'stable',
          datasource: 'docker',
          depName: 'dockersamples/visualizer',
          packageName: 'dockersamples/visualizer',
          replaceString: 'dockersamples/visualizer:stable',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          datasource: 'docker',
          replaceString: '${IMAGE:-synkodevelopers/edplugins}:${TAG:-latest}',
          skipReason: 'contains-variable',
        },
      ]);
      expect(res?.deps).toHaveLength(8);
    });

    it('extracts multiple image lines for version 3 without set version key', () => {
      const res = extractPackageFile(yamlFile3NoVersion, '', {});
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'alpine',
          datasource: 'docker',
          depName: 'quay.io/something/redis',
          packageName: 'quay.io/something/redis',
          replaceString: 'quay.io/something/redis:alpine',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '10.0.0',
          datasource: 'docker',
          depName: 'node',
          packageName: 'node',
          replaceString: 'node:10.0.0',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '9.4.0',
          datasource: 'docker',
          depName: 'postgres',
          packageName: 'postgres',
          replaceString: 'postgres:9.4.0',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'before',
          datasource: 'docker',
          depName: 'dockersamples/examplevotingapp_vote',
          packageName: 'dockersamples/examplevotingapp_vote',
          replaceString: 'dockersamples/examplevotingapp_vote:before',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'before',
          datasource: 'docker',
          depName: 'dockersamples/examplevotingapp_result',
          packageName: 'dockersamples/examplevotingapp_result',
          replaceString: 'dockersamples/examplevotingapp_result:before',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'dockersamples/examplevotingapp_worker',
          packageName: 'dockersamples/examplevotingapp_worker',
          replaceString: 'dockersamples/examplevotingapp_worker',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'stable',
          datasource: 'docker',
          depName: 'dockersamples/visualizer',
          packageName: 'dockersamples/visualizer',
          replaceString: 'dockersamples/visualizer:stable',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          datasource: 'docker',
          replaceString: '${IMAGE:-synkodevelopers/edplugins}:${TAG:-latest}',
          skipReason: 'contains-variable',
        },
      ]);
      expect(res?.deps).toHaveLength(8);
    });

    it('extracts default variable values for version 3', () => {
      const res = extractPackageFile(yamlFile3DefaultValue, '', {});
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: 'sha256:abcd',
          currentValue: '5.0.0',
          datasource: 'docker',
          depName: 'redis',
          packageName: 'redis',
          replaceString: 'redis:5.0.0@sha256:abcd',
        },
      ]);
      expect(res?.deps).toHaveLength(1);
    });

    it('extracts can parse yaml tags for version 3', () => {
      const compose = codeBlock`
          web:
            image: node:20.0.0
            ports:
              - "80:8000"
          worker:
            extends:
              service: web
            ports: !reset null
      `;
      const res = extractPackageFile(compose, '', {});
      expect(res).toEqual({
        deps: [
          {
            depName: 'node',
            packageName: 'node',
            currentValue: '20.0.0',
            currentDigest: undefined,
            replaceString: 'node:20.0.0',
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            datasource: 'docker',
          },
        ],
      });
    });

    it('extracts image and replaces registry', () => {
      const compose = codeBlock`
        version: "3"
        services:
          nginx:
            image: quay.io/nginx:0.0.1
      `;
      const res = extractPackageFile(compose, '', {
        registryAliases: {
          'quay.io': 'my-quay-mirror.registry.com',
        },
      });
      expect(res).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              'quay.io/nginx:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'quay.io/nginx',
            packageName: 'my-quay-mirror.registry.com/nginx',
            replaceString: 'quay.io/nginx:0.0.1',
          },
        ],
      });
    });

    it('extracts image but no replacement', () => {
      const compose = codeBlock`
        version: "3"
        services:
          nginx:
            image: quay.io/nginx:0.0.1
      `;
      const res = extractPackageFile(compose, '', {
        registryAliases: {
          'index.docker.io': 'my-docker-mirror.registry.com',
        },
      });
      expect(res).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'quay.io/nginx',
            packageName: 'quay.io/nginx',
            replaceString: 'quay.io/nginx:0.0.1',
          },
        ],
      });
    });

    it('extracts image and no double replacement', () => {
      const compose = codeBlock`
        version: "3"
        services:
          nginx:
            image: quay.io/nginx:0.0.1
      `;
      const res = extractPackageFile(compose, '', {
        registryAliases: {
          'quay.io': 'my-quay-mirror.registry.com',
          'my-quay-mirror.registry.com': 'quay.io',
        },
      });
      expect(res).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              'quay.io/nginx:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'quay.io/nginx',
            packageName: 'my-quay-mirror.registry.com/nginx',
            replaceString: 'quay.io/nginx:0.0.1',
          },
        ],
      });
    });

    it('extracts image of templated compose file', () => {
      const compose = codeBlock`
        version: "3"
        services:
          nginx:
            image: quay.io/nginx:0.0.1
            envrionment:
              {{ services['nginx']['env'] }}
      `;
      const res = extractPackageFile(compose, '', {});
      expect(res).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'quay.io/nginx',
            packageName: 'quay.io/nginx',
            replaceString: 'quay.io/nginx:0.0.1',
          },
        ],
      });
    });

    it('extract images from fragments', () => {
      const compose = codeBlock`
        ---
        x-shared_setting: &shared_settings
          image: debian:11
          # Other shared properties here

        services:
          service-a:
            <<: *shared_settings
            environment:
              - SERVICE=a
          service-b:
            <<: *shared_settings
            environment:
              - SERVICE=b
      `;
      const res = extractPackageFile(compose, '', {});
      expect(res).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '11',
            datasource: 'docker',
            depName: 'debian',
            packageName: 'debian',
            replaceString: 'debian:11',
            versioning: 'debian',
          },
        ],
      });
    });
  });
});

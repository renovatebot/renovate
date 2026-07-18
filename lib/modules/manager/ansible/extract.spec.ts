import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/ansible/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', '', {})).toBeNull();
    });

    it('extracts multiple image lines from docker_container', () => {
      const res = extractPackageFile(Fixtures.get('main1.yaml'), '', {});
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'busybox',
          packageName: 'busybox',
          replaceString: 'busybox',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'redis',
          packageName: 'redis',
          replaceString: 'redis',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'someuser/appimage',
          packageName: 'someuser/appimage',
          replaceString: 'someuser/appimage',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '14.04',
          datasource: 'docker',
          depName: 'ubuntu',
          packageName: 'ubuntu',
          replaceString: 'ubuntu:14.04',
          versioning: 'ubuntu',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'someuser/anotherappimage',
          packageName: 'someuser/anotherappimage',
          replaceString: 'someuser/anotherappimage',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'busybox',
          packageName: 'busybox',
          replaceString: 'busybox',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'latest',
          datasource: 'docker',
          depName: 'postgres',
          packageName: 'postgres',
          replaceString: 'postgres:latest',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '14.04',
          datasource: 'docker',
          depName: 'ubuntu',
          packageName: 'ubuntu',
          replaceString: 'ubuntu:14.04',
          versioning: 'ubuntu',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '14.04',
          datasource: 'docker',
          depName: 'ubuntu',
          packageName: 'ubuntu',
          replaceString: 'ubuntu:14.04',
          versioning: 'ubuntu',
        },
      ]);
      expect(res?.deps).toHaveLength(9);
    });

    it('extracts multiple image lines from docker_service', () => {
      const res = extractPackageFile(Fixtures.get('main2.yaml'), '', {});
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '11.5.1',
          datasource: 'docker',
          depName: 'sameersbn/gitlab',
          packageName: 'sameersbn/gitlab',
          replaceString: 'sameersbn/gitlab:11.5.1',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '10',
          datasource: 'docker',
          depName: 'sameersbn/postgresql',
          packageName: 'sameersbn/postgresql',
          replaceString: 'sameersbn/postgresql:10',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '4.0.9-1',
          datasource: 'docker',
          depName: 'sameersbn/redis',
          packageName: 'sameersbn/redis',
          replaceString: 'sameersbn/redis:4.0.9-1',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '2.6.2',
          datasource: 'docker',
          depName: 'registry',
          packageName: 'registry',
          replaceString: 'registry:2.6.2',
        },
      ]);
      expect(res?.deps).toHaveLength(4);
    });

    it('extracts image and replaces registry', () => {
      const res = extractPackageFile(
        codeBlock`
          ---
                  - name: Re-create a redis container
                      docker_container:
                      name: myredis
                      image: quay.io/redis:0.0.1
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
              'quay.io/redis:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'quay.io/redis',
            packageName: 'my-quay-mirror.registry.com/redis',
            replaceString: 'quay.io/redis:0.0.1',
          },
        ],
      });
    });

    it('extracts image but no replacement', () => {
      const res = extractPackageFile(
        codeBlock`
          ---
                  - name: Re-create a redis container
                    docker_container:
                    name: myredis
                    image: quay.io/redis:0.0.1
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
            depName: 'quay.io/redis',
            packageName: 'quay.io/redis',
            replaceString: 'quay.io/redis:0.0.1',
          },
        ],
      });
    });

    it('extracts image and no double replacement', () => {
      const res = extractPackageFile(
        codeBlock`
          ---
                  - name: Re-create a redis container
                    docker_container:
                    name: myredis
                    image: quay.io/redis:0.0.1
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
              'quay.io/redis:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'quay.io/redis',
            packageName: 'my-quay-mirror.registry.com/redis',
            replaceString: 'quay.io/redis:0.0.1',
          },
        ],
      });
    });
  });
});

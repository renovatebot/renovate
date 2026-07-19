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
      expect(res?.deps).toMatchObject([
        { depName: 'busybox' },
        { depName: 'redis' },
        { depName: 'someuser/appimage' },
        { depName: 'ubuntu', currentValue: '14.04' },
        { depName: 'someuser/anotherappimage' },
        { depName: 'busybox' },
        { depName: 'postgres', currentValue: 'latest' },
        { depName: 'ubuntu', currentValue: '14.04' },
        { depName: 'ubuntu', currentValue: '14.04' },
      ]);
      expect(res?.deps).toHaveLength(9);
    });

    it('extracts multiple image lines from docker_service', () => {
      const res = extractPackageFile(Fixtures.get('main2.yaml'), '', {});
      expect(res?.deps).toMatchObject([
        { depName: 'sameersbn/gitlab', currentValue: '11.5.1' },
        { depName: 'sameersbn/postgresql', currentValue: '10' },
        { depName: 'sameersbn/redis', currentValue: '4.0.9-1' },
        { depName: 'registry', currentValue: '2.6.2' },
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

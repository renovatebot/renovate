import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/ansible/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', '', {})).toBeNull();
    });

    it('extracts multiple image lines from docker_container', () => {
      const res = extractPackageFile(Fixtures.get('main1.yaml'), '', {});
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(9);
    });

    it('extracts multiple image lines from docker_service', () => {
      const res = extractPackageFile(Fixtures.get('main2.yaml'), '', {});
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(4);
    });

    it('extracts image and replaces registry', () => {
      const res = extractPackageFile(
        `---
        - name: Re-create a redis container
            docker_container:
            name: myredis
            image: quay.io/redis:0.0.1`,
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
              'quay.io/redis:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'my-quay-mirror.registry.com/redis',
            replaceString: 'quay.io/redis:0.0.1',
            versioning: 'docker',
          },
        ],
      });
    });

    it('extracts image but no replacement', () => {
      const res = extractPackageFile(
        `---
        - name: Re-create a redis container
          docker_container:
          name: myredis
          image: quay.io/redis:0.0.1`,
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
            depName: 'quay.io/redis',
            replaceString: 'quay.io/redis:0.0.1',
            versioning: 'docker',
          },
        ],
      });
    });

    it('extracts image and no double replacement', () => {
      const res = extractPackageFile(
        `---
        - name: Re-create a redis container
          docker_container:
          name: myredis
          image: quay.io/redis:0.0.1`,
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
              'quay.io/redis:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: '0.0.1',
            datasource: 'docker',
            depName: 'my-quay-mirror.registry.com/redis',
            replaceString: 'quay.io/redis:0.0.1',
            versioning: 'docker',
          },
        ],
      });
    });
  });
});

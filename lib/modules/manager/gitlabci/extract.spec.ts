import { codeBlock } from 'common-tags';
import { logger } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import type { ExtractConfig, PackageDependency } from '../types.ts';
import { extractAllPackageFiles, extractPackageFile } from './index.ts';

const config: ExtractConfig = {};

const adminConfig: RepoGlobalConfig = { localDir: '' };

describe('modules/manager/gitlabci/extract', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  describe('extractAllPackageFile()', () => {
    it('extracts from empty file', () => {
      expect(extractPackageFile('', '', {})).toBeNull();
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('returns null for empty', async () => {
      expect(
        await extractAllPackageFiles(config, [
          'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.2.yaml',
        ]),
      ).toBeNull();
    });

    it('extracts from multidoc yaml', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.multi-doc.yaml',
      ]);
      expect(res).toHaveLength(3);

      const deps = res?.map((entry) => entry.deps).flat();
      expect(deps).toHaveLength(8);
    });

    it('extracts multiple included image lines', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.3.yaml',
      ]);
      expect(res).toMatchObject([
        {
          packageFile:
            'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.3.yaml',
          deps: [
            {
              depName: 'renovate/renovate',
              currentValue: '19.70.8-slim',
              depType: 'image-name',
            },
            {
              depName: 'mariadb',
              currentValue: '10.4.11',
              depType: 'service-image',
            },
            {
              depName: 'other/image',
              currentValue: '1.0.0',
              depType: 'service-image',
            },
          ],
        },
        {
          packageFile:
            'lib/modules/manager/gitlabci/__fixtures__/include.1.yml',
          deps: [{ depName: 'node', currentValue: '12', depType: 'image' }],
        },
        {
          packageFile: 'lib/modules/manager/gitlabci/__fixtures__/include.yml',
          deps: [{ depName: 'alpine', currentValue: '3.11', depType: 'image' }],
        },
      ]);
      expect(res).toHaveLength(3);

      const deps = res?.map((entry) => entry.deps).flat();
      expect(deps).toHaveLength(5);
    });

    it('extracts named services', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.5.yaml',
      ]);
      expect(res).toMatchObject([
        {
          packageFile:
            'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.5.yaml',
          deps: [
            {
              depName: 'renovate/renovate',
              currentValue: '19.70.8-slim',
              depType: 'image-name',
            },
            {
              depName: 'mariadb',
              currentValue: '10.4.11',
              depType: 'service-image',
            },
            {
              depName: 'other/image',
              currentValue: '1.0.0',
              depType: 'service-image',
            },
          ],
        },
      ]);
      expect(res).toHaveLength(1);
      expect(res?.[0].deps).toHaveLength(3);
    });

    it('extracts multiple named services', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.6.yaml',
      ]);
      expect(res).toMatchObject([
        {
          packageFile:
            'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.6.yaml',
          deps: [
            {
              depName: 'renovate/renovate',
              currentValue: '19.70.8-slim',
              depType: 'image-name',
            },
            {
              depName: 'other/image1',
              currentValue: '1.0.0',
              depType: 'service-image',
            },
            {
              depName: 'other/image2',
              currentValue: '1.0.0',
              depType: 'service-image',
            },
            {
              depName: 'mooseagency/postgresql',
              currentValue: '12.3-1',
              currentDigest:
                'sha256:a5a65569456f221ee1f8a0b3b4e2d440eb5830772d9440c9b30b1dbfd454c778',
              depType: 'service-image',
            },
            {
              depName: 'mariadb',
              currentValue: '10.4.11',
              depType: 'service-image',
            },
            {
              depName: 'postgres',
              currentValue: '11.7',
              depType: 'service-image',
            },
            {
              depName: 'redis',
              currentValue: 'latest',
              depType: 'service-image',
            },
            {
              depName: 'registry.example.com/myimage',
              currentValue: 'latest',
              depType: 'service-image',
            },
            {
              depName: 'myimage',
              currentDigest: 'sha256:0ecb2ad60',
              depType: 'service-image',
            },
            {
              depName: 'tomcat',
              currentValue: '7-jre8',
              depType: 'service-image',
            },
          ],
        },
      ]);
      expect(res).toHaveLength(1);
      expect(res?.[0].deps).toHaveLength(10);
    });

    it('extracts multiple image lines', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.yaml',
      ]);
      expect(res).toMatchObject([
        {
          packageFile:
            'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.yaml',
          deps: [
            { depName: 'ruby', currentValue: '2.5.0', depType: 'image' },
            {
              depName: 'hadolint/hadolint',
              currentValue: 'latest',
              depType: 'image',
            },
            { depName: 'docker', currentValue: 'latest', depType: 'image' },
            {
              depName: 'docker',
              currentValue: 'dind',
              depType: 'service-image',
            },
            { depName: 'docker', currentValue: 'latest', depType: 'image' },
            {
              depName: 'docker',
              currentValue: 'dind',
              depType: 'service-image',
            },
            {
              depName: 'image-name-test',
              currentValue: '1.15',
              depType: 'image-name',
            },
            {
              depName: 'image-name-test',
              currentValue: '1.15',
              depType: 'image-name',
            },
          ],
        },
      ]);
      expect(res).toHaveLength(1);

      const deps: PackageDependency[] = [];
      res?.forEach((e) => {
        e.deps.forEach((d) => {
          deps.push(d);
        });
      });
      expect(deps).toHaveLength(8);

      // TODO #22198
      expect(deps.some((dep) => dep.currentValue!.includes("'"))).toBeFalse();
    });

    it('extracts multiple image lines with comments', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.1.yaml',
      ]);
      expect(res).toMatchObject([
        {
          packageFile:
            'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.1.yaml',
          deps: [
            {
              depName: 'renovate/renovate',
              currentValue: '19.70.8-slim',
              depType: 'image-name',
            },
            {
              depName: 'mariadb',
              currentValue: '10.4.11',
              depType: 'service-image',
            },
            {
              depName: 'other/image',
              currentValue: '1.0.0',
              depType: 'service-image',
            },
          ],
        },
      ]);
      expect(res).toHaveLength(1);

      const deps: PackageDependency[] = [];
      res?.forEach((e) => {
        e.deps.forEach((d) => {
          deps.push(d);
        });
      });
      expect(deps).toHaveLength(3);
    });

    it('catches errors', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.4.yaml',
      ]);
      expect(res).toBeNull();
      expect(logger.logger.debug).toHaveBeenCalled();
    });

    it('skips images with variables', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.7.yaml',
      ]);
      expect(res).toEqual([
        {
          deps: [
            {
              autoReplaceStringTemplate:
                '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
              datasource: 'docker',
              depType: 'image-name',
              replaceString: '$VARIABLE/renovate/renovate:31.65.1-slim',
              skipReason: 'contains-variable',
            },
            {
              autoReplaceStringTemplate:
                '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
              datasource: 'docker',
              depType: 'service-image',
              replaceString: '$VARIABLE/other/image1:1.0.0',
              skipReason: 'contains-variable',
            },
            {
              autoReplaceStringTemplate:
                '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
              datasource: 'docker',
              depType: 'service-image',
              replaceString: '${VARIABLE}/other/image1:2.0.0',
              skipReason: 'contains-variable',
            },
            {
              autoReplaceStringTemplate:
                '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
              datasource: 'docker',
              depType: 'service-image',
              replaceString: 'docker.io/$VARIABLE/image1:3.0.0',
              skipReason: 'contains-variable',
            },
            {
              autoReplaceStringTemplate:
                '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
              datasource: 'docker',
              depType: 'service-image',
              replaceString: 'docker.io/${VARIABLE}/image1:4.0.0',
              skipReason: 'contains-variable',
            },
          ],
          packageFile:
            'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.7.yaml',
        },
      ]);
    });

    it('extract images from dependency proxy', () => {
      const res = extractPackageFile(
        `
        image:
          name: $\{CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX}/renovate/renovate:31.65.1-slim

        services:
          - $CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX/mariadb:10.4.11
          - name: $CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX/other/image1:1.0.0
            alias: imagealias1
      `,
        '',
        {},
      );
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '${CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX}/' +
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '31.65.1-slim',
          datasource: 'docker',
          depName: 'renovate/renovate',
          packageName: 'renovate/renovate',
          depType: 'image-name',
          replaceString:
            '${CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX}/renovate/renovate:31.65.1-slim',
        },
        {
          autoReplaceStringTemplate:
            '$CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX/' +
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '10.4.11',
          datasource: 'docker',
          depName: 'mariadb',
          packageName: 'mariadb',
          depType: 'service-image',
          replaceString:
            '$CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX/mariadb:10.4.11',
        },
        {
          autoReplaceStringTemplate:
            '$CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX/' +
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.0.0',
          datasource: 'docker',
          depName: 'other/image1',
          packageName: 'other/image1',
          depType: 'service-image',
          replaceString:
            '$CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX/other/image1:1.0.0',
        },
      ]);
    });

    it('extract images via registry aliases', () => {
      const registryAliases = {
        $CI_REGISTRY: 'registry.com',
        $BUILD_IMAGES: 'registry.com/build-images',
        foo: 'foo.registry.com',
      };
      const res = extractPackageFile(
        `
        image:
          name: $CI_REGISTRY/renovate/renovate:31.65.1-slim

        services:
          - foo/mariadb:10.4.11
          - name: $CI_REGISTRY/other/image1:1.0.0
            alias: imagealias1
          - $BUILD_IMAGES/image2:1.0.0
      `,
        '',
        {
          registryAliases,
        },
      );
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '$CI_REGISTRY/renovate/renovate:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '31.65.1-slim',
          datasource: 'docker',
          depName: '$CI_REGISTRY/renovate/renovate',
          packageName: 'registry.com/renovate/renovate',
          depType: 'image-name',
          replaceString: '$CI_REGISTRY/renovate/renovate:31.65.1-slim',
        },
        {
          autoReplaceStringTemplate:
            'foo/mariadb:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '10.4.11',
          datasource: 'docker',
          depName: 'foo/mariadb',
          packageName: 'foo.registry.com/mariadb',
          depType: 'service-image',
          replaceString: 'foo/mariadb:10.4.11',
        },
        {
          autoReplaceStringTemplate:
            '$CI_REGISTRY/other/image1:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.0.0',
          datasource: 'docker',
          depName: '$CI_REGISTRY/other/image1',
          packageName: 'registry.com/other/image1',
          depType: 'service-image',
          replaceString: '$CI_REGISTRY/other/image1:1.0.0',
        },
        {
          autoReplaceStringTemplate:
            '$BUILD_IMAGES/image2:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: '1.0.0',
          datasource: 'docker',
          depName: '$BUILD_IMAGES/image2',
          packageName: 'registry.com/build-images/image2',
          depType: 'service-image',
          replaceString: '$BUILD_IMAGES/image2:1.0.0',
        },
      ]);
    });

    it('extracts component references via registry aliases', () => {
      const registryAliases = {
        $CI_SERVER_HOST: 'gitlab.example.com',
        $COMPONENT_REGISTRY: 'gitlab.example.com/a-group',
      };
      const content = codeBlock`
        include:
          - component: $CI_SERVER_HOST/an-org/a-project/a-component@1.0
            inputs:
              stage: build
          - component: $CI_SERVER_HOST/an-org/a-subgroup/a-project/a-component@e3262fdd0914fa823210cdb79a8c421e2cef79d8
          - component: $CI_SERVER_HOST/an-org/a-subgroup/another-project/a-component@main
          - component: $CI_SERVER_HOST/another-org/a-project/a-component@~latest
            inputs:
              stage: test
          - component: $CI_SERVER_HOST/malformed-component-reference
          - component:
              malformed: true
          - component: $CI_SERVER_HOST/an-org/a-component@1.0
          - component: other-gitlab.example.com/an-org/a-project/a-component@1.0
          - component: $COMPONENT_REGISTRY/a-project/a-component@1.0
      `;
      const res = extractPackageFile(content, '', {
        registryAliases,
      });
      expect(res?.deps).toMatchObject([
        {
          currentValue: '1.0',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
          versioning: 'semver-partial',
        },
        {
          currentValue: 'e3262fdd0914fa823210cdb79a8c421e2cef79d8',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-subgroup/a-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
          versioning: 'semver-partial',
        },
        {
          currentValue: 'main',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-subgroup/another-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
          versioning: 'semver-partial',
        },
        {
          currentValue: '~latest',
          datasource: 'gitlab-tags',
          depName: 'another-org/a-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
          versioning: 'semver-partial',
          skipReason: 'unsupported-version',
        },
        {
          currentValue: '1.0',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-project',
          depType: 'repository',
          registryUrls: ['https://other-gitlab.example.com'],
          versioning: 'semver-partial',
        },
        {
          currentValue: '1.0',
          datasource: 'gitlab-tags',
          depName: 'a-group/a-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
          versioning: 'semver-partial',
        },
      ]);
    });

    it('extracts component references', () => {
      const content = codeBlock`
        include:
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
          - component: other-gitlab.example.com/an-org/a-project/a-component@1.0
      `;
      const res = extractPackageFile(content, '', {});
      expect(res?.deps).toMatchObject([
        {
          currentValue: '1.0',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
          versioning: 'semver-partial',
        },
        {
          currentValue: 'e3262fdd0914fa823210cdb79a8c421e2cef79d8',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-subgroup/a-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
          versioning: 'semver-partial',
        },
        {
          currentValue: 'main',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-subgroup/another-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
          versioning: 'semver-partial',
        },
        {
          currentValue: '~latest',
          datasource: 'gitlab-tags',
          depName: 'another-org/a-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
          versioning: 'semver-partial',
          skipReason: 'unsupported-version',
        },
        {
          currentValue: '1.0',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-project',
          depType: 'repository',
          versioning: 'semver-partial',
          registryUrls: ['https://other-gitlab.example.com'],
        },
      ]);
    });
  });
});

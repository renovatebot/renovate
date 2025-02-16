import { codeBlock } from 'common-tags';
import { logger } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { ExtractConfig, PackageDependency } from '../types';
import {
  extractFromImage,
  extractFromJob,
  extractFromServices,
} from './extract';
import { extractAllPackageFiles, extractPackageFile } from '.';

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
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);

      const deps = res?.map((entry) => entry.deps).flat();
      expect(deps).toHaveLength(5);
    });

    it('extracts named services', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.5.yaml',
      ]);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res?.[0].deps).toHaveLength(3);
    });

    it('extracts multiple named services', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.6.yaml',
      ]);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res?.[0].deps).toHaveLength(10);
    });

    it('extracts multiple image lines', async () => {
      const res = await extractAllPackageFiles(config, [
        'lib/modules/manager/gitlabci/__fixtures__/gitlab-ci.yaml',
      ]);
      expect(res).toMatchSnapshot();
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
      expect(res).toMatchSnapshot();
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

    it('extracts from image', () => {
      let expectedRes = {
        autoReplaceStringTemplate:
          '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        currentDigest: undefined,
        currentValue: 'test',
        datasource: 'docker',
        depName: 'image',
        packageName: 'image',
        depType: 'image',
        replaceString: 'image:test',
      };

      expect(extractFromImage('image:test')).toEqual(expectedRes);

      expectedRes = { ...expectedRes, depType: 'image-name' };
      expect(
        extractFromImage({
          name: 'image:test',
        }),
      ).toEqual(expectedRes);

      expect(extractFromImage(undefined)).toBeNull();
    });

    it('extracts from services', () => {
      const expectedRes = [
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'test',
          datasource: 'docker',
          depName: 'image',
          packageName: 'image',
          depType: 'service-image',
          replaceString: 'image:test',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'test2',
          datasource: 'docker',
          depName: 'image2',
          packageName: 'image2',
          depType: 'service-image',
          replaceString: 'image2:test2',
        },
      ];
      const services = ['image:test', 'image2:test2'];
      expect(extractFromServices(undefined)).toBeEmptyArray();
      expect(extractFromServices(services)).toEqual(expectedRes);
      expect(
        extractFromServices([{ name: 'image:test' }, { name: 'image2:test2' }]),
      ).toEqual(expectedRes);
    });

    it('extracts from job object', () => {
      const expectedRes = [
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'test',
          datasource: 'docker',
          depName: 'image',
          packageName: 'image',
          depType: 'image',
          replaceString: 'image:test',
        },
      ];
      expect(extractFromJob(undefined)).toBeEmptyArray();
      expect(extractFromJob({ image: 'image:test' })).toEqual(expectedRes);
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
        },
        {
          currentValue: 'e3262fdd0914fa823210cdb79a8c421e2cef79d8',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-subgroup/a-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
        },
        {
          currentValue: 'main',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-subgroup/another-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
        },
        {
          currentValue: '~latest',
          datasource: 'gitlab-tags',
          depName: 'another-org/a-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
          skipReason: 'unsupported-version',
        },
        {
          currentValue: '1.0',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-project',
          depType: 'repository',
          registryUrls: ['https://other-gitlab.example.com'],
        },
        {
          currentValue: '1.0',
          datasource: 'gitlab-tags',
          depName: 'a-group/a-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
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
        },
        {
          currentValue: 'e3262fdd0914fa823210cdb79a8c421e2cef79d8',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-subgroup/a-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
        },
        {
          currentValue: 'main',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-subgroup/another-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
        },
        {
          currentValue: '~latest',
          datasource: 'gitlab-tags',
          depName: 'another-org/a-project',
          depType: 'repository',
          registryUrls: ['https://gitlab.example.com'],
          skipReason: 'unsupported-version',
        },
        {
          currentValue: '1.0',
          datasource: 'gitlab-tags',
          depName: 'an-org/a-project',
          depType: 'repository',
          registryUrls: ['https://other-gitlab.example.com'],
        },
      ]);
    });
  });
});

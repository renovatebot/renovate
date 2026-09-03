import type { PackageDependency } from '../types.ts';
import { getGitlabDep } from './utils.ts';

describe('modules/manager/gitlabci/utils', () => {
  describe('getGitlabDep', () => {
    const versionAndDigestTemplate =
      ':{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}';
    const defaultAutoReplaceStringTemplate =
      '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}';

    it.each`
      name                           | imagePrefix
      ${'no variable'}               | ${''}
      ${'group proxy'}               | ${'$CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX/'}
      ${'group proxy with brackets'} | ${'${CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX}/'}
      ${'direct group proxy'}        | ${'$CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX/'}
    `('offical image - $name', ({ imagePrefix }: { imagePrefix: string }) => {
      const imageName = `${imagePrefix}mariadb:10.4.11`;
      expect(getGitlabDep(imageName)).toMatchObject({
        autoReplaceStringTemplate:
          imagePrefix + defaultAutoReplaceStringTemplate,
        replaceString: imageName,
        depName: 'mariadb',
        currentValue: '10.4.11',
      });
    });

    it.each`
      name                           | imagePrefix
      ${'no variable'}               | ${''}
      ${'group proxy'}               | ${'$CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX/'}
      ${'group proxy with brackets'} | ${'${CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX}/'}
      ${'direct group proxy'}        | ${'$CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX/'}
    `(
      'image with organization - $name',
      ({ imagePrefix }: { imagePrefix: string }) => {
        const imageName = `${imagePrefix}renovate/renovate:19.70.8-slim`;
        expect(getGitlabDep(imageName)).toMatchObject({
          autoReplaceStringTemplate:
            imagePrefix + defaultAutoReplaceStringTemplate,
          replaceString: imageName,
          depName: 'renovate/renovate',
          currentValue: '19.70.8-slim',
        });
      },
    );

    it.each`
      name                                  | registryAliases                                                                                 | imageName                                                                                          | dep
      ${'multiple aliases'}                 | ${{ foo: 'foo.registry.com', bar: 'bar.registry.com' }}                                         | ${'foo/image:1.0'}                                                                                 | ${{ depName: 'foo/image', packageName: 'foo.registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: `foo/image${versionAndDigestTemplate}` }}
      ${'aliased variable'}                 | ${{ $CI_REGISTRY: 'registry.com' }}                                                             | ${'$CI_REGISTRY/image:1.0'}                                                                        | ${{ depName: '$CI_REGISTRY/image', packageName: 'registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: `$CI_REGISTRY/image${versionAndDigestTemplate}` }}
      ${'overlapping prefixes'}             | ${{ $CI_REGISTRY: 'registry.example.com', $CI_REGISTRY_IMAGE: 'registry.example.com/project' }} | ${'$CI_REGISTRY_IMAGE/image:1.0'}                                                                  | ${{ depName: '$CI_REGISTRY_IMAGE/image', packageName: 'registry.example.com/project/image', currentValue: '1.0', autoReplaceStringTemplate: `$CI_REGISTRY_IMAGE/image${versionAndDigestTemplate}` }}
      ${'variables with brackets'}          | ${{ '${CI_REGISTRY}': 'registry.com' }}                                                         | ${'${CI_REGISTRY}/image:1.0'}                                                                      | ${{ depName: '${CI_REGISTRY}/image', packageName: 'registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: `$\{CI_REGISTRY}/image${versionAndDigestTemplate}` }}
      ${'variables with default and slash'} | ${{ '${CI_REGISTRY:-}': 'registry.com' }}                                                       | ${'${CI_REGISTRY:-}/image:1.0'}                                                                    | ${{ depName: '${CI_REGISTRY:-}/image', packageName: 'registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: `$\{CI_REGISTRY:-}/image${versionAndDigestTemplate}` }}
      ${'variables with default no slash'}  | ${{ '${CI_REGISTRY:-}': 'registry.com/' }}                                                      | ${'${CI_REGISTRY:-}image:1.0'}                                                                     | ${{ depName: '${CI_REGISTRY:-}image', packageName: 'registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: `$\{CI_REGISTRY:-}image${versionAndDigestTemplate}` }}
      ${'alias with digest only'}           | ${{ '${CI_REGISTRY:-}': 'registry.com' }}                                                       | ${'${CI_REGISTRY:-}image@sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'} | ${{ depName: '${CI_REGISTRY:-}image', packageName: 'registry.com/image', currentDigest: 'sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789', autoReplaceStringTemplate: `$\{CI_REGISTRY:-}image@{{#if newDigest}}{{newDigest}}{{/if}}` }}
      ${'not aliased variable'}             | ${{}}                                                                                           | ${'$CI_REGISTRY/image:1.0'}                                                                        | ${{ autoReplaceStringTemplate: defaultAutoReplaceStringTemplate }}
      ${'plain image'}                      | ${{}}                                                                                           | ${'registry.com/image:1.0'}                                                                        | ${{ depName: 'registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: defaultAutoReplaceStringTemplate }}
    `(
      'supports registry aliases - $name',
      ({
        registryAliases,
        imageName,
        dep,
      }: {
        registryAliases: Record<string, string>;
        imageName: string;
        dep: PackageDependency;
      }) => {
        expect(getGitlabDep(imageName, registryAliases)).toMatchObject({
          ...dep,
          replaceString: imageName,
        });
      },
    );

    it('no Docker hub', () => {
      expect(
        getGitlabDep('quay.io/prometheus/node-exporter:v1.3.1'),
      ).toMatchObject({
        autoReplaceStringTemplate: defaultAutoReplaceStringTemplate,
        replaceString: 'quay.io/prometheus/node-exporter:v1.3.1',
        depName: 'quay.io/prometheus/node-exporter',
        currentValue: 'v1.3.1',
      });
    });
  });
});

import type { PackageDependency } from '../types';
import { getGitlabDep } from './utils';

describe('modules/manager/gitlabci/utils', () => {
  describe('getGitlabDep', () => {
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
      }
    );

    it.each`
      name   | registryAliases                                         | imageName                     | dep
      ${'a'} | ${{ foo: 'foo.registry.com', bar: 'bar.registry.com' }} | ${'foo/image:1.0'}            | ${{ depName: 'foo.registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: `foo/${defaultAutoReplaceStringTemplate}` }}
      ${'b'} | ${{ $CI_REGISTRY: 'registry.com' }}                     | ${'$CI_REGISTRY/image:1.0'}   | ${{ depName: 'registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: `$CI_REGISTRY/${defaultAutoReplaceStringTemplate}` }}
      ${'c'} | ${{ '${CI_REGISTRY}': 'registry.com' }}                 | ${'${CI_REGISTRY}/image:1.0'} | ${{ depName: 'registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: `$\{CI_REGISTRY}/${defaultAutoReplaceStringTemplate}` }}
      ${'d'} | ${{}}                                                   | ${'$CI_REGISTRY/image:1.0'}   | ${{ autoReplaceStringTemplate: `${defaultAutoReplaceStringTemplate}` }}
      ${'e'} | ${{}}                                                   | ${'registry.com/image:1.0'}   | ${{ depName: 'registry.com/image', currentValue: '1.0', autoReplaceStringTemplate: `${defaultAutoReplaceStringTemplate}` }}
    `(
      'supports registry variable - $name',
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
      }
    );

    it('no Docker hub', () => {
      expect(
        getGitlabDep('quay.io/prometheus/node-exporter:v1.3.1')
      ).toMatchObject({
        autoReplaceStringTemplate: defaultAutoReplaceStringTemplate,
        replaceString: 'quay.io/prometheus/node-exporter:v1.3.1',
        depName: 'quay.io/prometheus/node-exporter',
        currentValue: 'v1.3.1',
      });
    });
  });
});

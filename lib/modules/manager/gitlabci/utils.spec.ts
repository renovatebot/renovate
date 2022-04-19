import { getGitlabDep } from './utils';

describe('modules/manager/gitlabci/utils', () => {
  describe('getGitlabDep', () => {
    it.each`
      name                        | imageName
      ${'no variable'}            | ${'mariadb:10.4.11'}
      ${'variable'}               | ${'$CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX/mariadb:10.4.11'}
      ${'variable with brackets'} | ${'${CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX}/mariadb:10.4.11'}
    `('offical image - $name', ({ imageName }: { imageName: string }) => {
      expect(getGitlabDep(imageName)).toMatchObject({
        replaceString: 'mariadb:10.4.11',
        depName: 'mariadb',
        currentValue: '10.4.11',
      });
    });

    it.each`
      name                        | imageName
      ${'no variable'}            | ${'renovate/renovate:19.70.8-slim'}
      ${'variable'}               | ${'$CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX/renovate/renovate:19.70.8-slim'}
      ${'variable with brackets'} | ${'${CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX}/renovate/renovate:19.70.8-slim'}
    `(
      'image with organization - %s',
      ({ imageName }: { imageName: string }) => {
        expect(getGitlabDep(imageName)).toMatchObject({
          replaceString: 'renovate/renovate:19.70.8-slim',
          depName: 'renovate/renovate',
          currentValue: '19.70.8-slim',
        });
      }
    );

    it('no Docker hub', () => {
      expect(
        getGitlabDep('quay.io/prometheus/node-exporter:v1.3.1')
      ).toMatchObject({
        replaceString: 'quay.io/prometheus/node-exporter:v1.3.1',
        depName: 'quay.io/prometheus/node-exporter',
        currentValue: 'v1.3.1',
      });
    });

    it('empty', () => {
      expect(getGitlabDep('')).toMatchObject({
        replaceString: '',
        depName: '',
        currentValue: undefined,
      });
    });
  });
});

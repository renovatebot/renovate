import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const validApplication = Fixtures.get('validApplication.yml');
const malformedApplication = Fixtures.get('malformedApplications.yml');
const randomManifest = Fixtures.get('randomManifest.yml');
const validApplicationSet = Fixtures.get('validApplicationSet.yml');

describe('modules/manager/argocd/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', 'applications.yml')).toBeNull();
    });

    it('returns null for invalid', () => {
      expect(
        extractPackageFile(`${malformedApplication}\n123`, 'applications.yml')
      ).toBeNull();
    });

    it('return null for kubernetes manifest', () => {
      const result = extractPackageFile(randomManifest, 'applications.yml');
      expect(result).toBeNull();
    });

    it('return null if deps array would be empty', () => {
      const result = extractPackageFile(
        malformedApplication,
        'applications.yml'
      );
      expect(result).toBeNull();
    });

    it('full test', () => {
      const result = extractPackageFile(validApplication, 'applications.yml');
      expect(result).toEqual({
        deps: [
          {
            currentValue: '2.4.1',
            datasource: 'helm',
            depName: 'kube-state-metrics',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
          {
            currentValue: '0.0.2',
            datasource: 'helm',
            depName: 'traefik',
            registryUrls: ['gs://helm-charts-internal'],
          },
          {
            currentValue: 'v1.2.0',
            datasource: 'git-tags',
            depName: 'https://git.example.com/foo/bar.git',
          },
          {
            currentValue: '1.2.0',
            datasource: 'docker',
            depName: 'somecontainer.registry.io/some/image',
          },
          {
            currentValue: '1.3.0',
            datasource: 'docker',
            depName: 'somecontainer.registry.io/some/image2',
          },
          {
            currentValue: '1.3.0',
            datasource: 'docker',
            depName: 'somecontainer.registry.io:443/some/image2',
          },
          {
            currentValue: '1.0.0',
            datasource: 'docker',
            depName: 'somecontainer.registry.io:443/some/image3',
          },
        ],
      });
    });

    it('supports applicationsets', () => {
      const result = extractPackageFile(
        validApplicationSet,
        'applicationsets.yml'
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '2.4.1',
            datasource: 'helm',
            depName: 'kube-state-metrics',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
          {
            currentValue: '10.14.2',
            datasource: 'helm',
            depName: 'traefik',
            registryUrls: ['https://helm.traefik.io/traefik'],
          },
          {
            currentValue: 'v1.2.0',
            datasource: 'git-tags',
            depName: 'https://git.example.com/foo/bar.git',
          },
          {
            currentValue: '6.0.0',
            datasource: 'helm',
            depName: 'podinfo',
            registryUrls: ['https://stefanprodan.github.io/podinfo'],
          },
        ],
      });
    });
  });
});

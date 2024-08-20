import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const validProfile = Fixtures.get('validProfile.yml');
const validClusterProfile = Fixtures.get('validClusterProfile.yml');
const validEventTrigger = Fixtures.get('validEventTrigger.yml');
const malformedProfiles = Fixtures.get('malformedProfiles.yml');
const randomManifest = Fixtures.get('randomManifest.yml');

describe('modules/manager/sveltos/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', 'sveltos.yml')).toBeNull();
    });

    it('returns null for invalid', () => {
      expect(
        extractPackageFile(`${malformedProfiles}\n123`, 'sveltos.yml'),
      ).toBeNull();
    });

    it('return null for Kubernetes manifest', () => {
      const result = extractPackageFile(randomManifest, 'sveltos.yml');
      expect(result).toBeNull();
    });

    it('return null if deps array would be empty', () => {
      const result = extractPackageFile(malformedProfiles, 'applications.yml');
      expect(result).toBeNull();
    });

    it('return result for double quoted argoproj.io apiVersion reference', () => {
      const result = extractPackageFile(
        codeBlock`
          apiVersion: "config.projectsveltos.io/v1beta1"
          kind: ClusterProfile
          metadata:
            name: prometheus
          spec:
            helmCharts:
            - repositoryURL:    https://prometheus-community.github.io/helm-charts
              repositoryName:   prometheus-community
              chartName:        prometheus-community/prometheus
              chartVersion:     "23.4.0"
        `,
        'sveltos.yml',
      );
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '23.4.0',
            datasource: 'helm',
            depType: 'ClusterProfile',
            depName: 'prometheus',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
        ],
      });
    });

    it('return result for single quoted argoproj.io apiVersion reference', () => {
      const result = extractPackageFile(
        codeBlock`
          apiVersion: 'config.projectsveltos.io/v1beta1'
          kind: ClusterProfile
          metadata:
            name: prometheus
          spec:
            helmCharts:
            - repositoryURL:    https://prometheus-community.github.io/helm-charts
              repositoryName:   prometheus-community
              chartName:        prometheus-community/prometheus
              chartVersion:     "23.4.0"
        `,
        'applications.yml',
      );
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '23.4.0',
            datasource: 'helm',
            depType: 'ClusterProfile',
            depName: 'prometheus',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
        ],
      });
    });

    it('supports profiles', () => {
      const result = extractPackageFile(validProfile, 'profiles.yml');
      expect(result).toEqual({
        deps: [
          {
            currentValue: '23.4.0',
            datasource: 'helm',
            depType: 'Profile',
            depName: 'prometheus',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
          {
            currentValue: 'v3.2.5',
            datasource: 'helm',
            depType: 'Profile',
            depName: 'kyverno',
            registryUrls: ['https://kyverno.github.io/kyverno/'],
          },
          {
            currentValue: 'v3.2.0',
            datasource: 'helm',
            depType: 'Profile',
            depName: 'kyverno-policies',
            registryUrls: ['https://kyverno.github.io/kyverno/'],
          },
          {
            currentValue: '0.7.2',
            datasource: 'docker',
            depType: 'Profile',
            depName: 'registry-1.docker.io/bitnamicharts/vault',
          },
          {
            currentValue: '0.5.0',
            datasource: 'docker',
            depType: 'Profile',
            depName: 'custom-registry:443/charts/vault-sidecar',
          },
        ],
      });
    });

    it('supports clusterprofiles', () => {
      const result = extractPackageFile(
        validClusterProfile,
        'clusterprofiles.yml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '23.4.0',
            datasource: 'helm',
            depType: 'ClusterProfile',
            depName: 'prometheus',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
          {
            currentValue: 'v3.2.5',
            datasource: 'helm',
            depType: 'ClusterProfile',
            depName: 'kyverno',
            registryUrls: ['https://kyverno.github.io/kyverno/'],
          },
          {
            currentValue: 'v3.2.0',
            datasource: 'helm',
            depType: 'ClusterProfile',
            depName: 'kyverno-policies',
            registryUrls: ['https://kyverno.github.io/kyverno/'],
          },
          {
            currentValue: '0.7.2',
            datasource: 'docker',
            depType: 'ClusterProfile',
            depName: 'registry-1.docker.io/bitnamicharts/vault',
          },
          {
            currentValue: '0.5.0',
            datasource: 'docker',
            depType: 'ClusterProfile',
            depName: 'custom-registry:443/charts/vault-sidecar',
          },
        ],
      });
    });

    it('supports eventtriggers', () => {
      const result = extractPackageFile(validEventTrigger, 'eventtriggers.yml');
      expect(result).toEqual({
        deps: [
          {
            currentValue: '23.4.0',
            datasource: 'helm',
            depName: 'prometheus',
            depType: 'EventTrigger',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
          {
            currentValue: 'v3.2.5',
            datasource: 'helm',
            depName: 'kyverno',
            depType: 'EventTrigger',
            registryUrls: ['https://kyverno.github.io/kyverno/'],
          },
          {
            currentValue: 'v3.2.0',
            datasource: 'helm',
            depName: 'kyverno-policies',
            depType: 'EventTrigger',
            registryUrls: ['https://kyverno.github.io/kyverno/'],
          },
          {
            currentValue: '0.7.2',
            datasource: 'docker',
            depType: 'EventTrigger',
            depName: 'registry-1.docker.io/bitnamicharts/vault',
          },
          {
            currentValue: '0.5.0',
            datasource: 'docker',
            depType: 'EventTrigger',
            depName: 'custom-registry:443/charts/vault-sidecar',
          },
        ],
      });
    });
  });
});

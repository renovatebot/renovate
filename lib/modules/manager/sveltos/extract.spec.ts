import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { extractDefinition } from './extract';
import type { ProfileDefinition } from './schema';
import { extractPackageFile } from '.';

const validProfile = Fixtures.get('validProfile.yml');
const validClusterProfile = Fixtures.get('validClusterProfile.yml');
const validClusterProfileOCI = Fixtures.get('validClusterProfileOCI.yml');
const validEventTrigger = Fixtures.get('validEventTrigger.yml');
const malformedProfiles = Fixtures.get('malformedProfiles.yml');
const randomManifest = Fixtures.get('randomManifest.yml');

describe('modules/manager/sveltos/extract', () => {
  describe('extractDefinition()', () => {
    it('returns an empty array when parsing fails', () => {
      const invalidDefinition = {};
      const result = extractDefinition(invalidDefinition as ProfileDefinition);
      expect(result).toEqual([]);
    });

    it('returns null if extractDefinition returns an empty array', () => {
      const validYAML = codeBlock`
        apiVersion: "config.projectsveltos.io/v1beta1"
        kind: ClusterProfile
        metadata:
          name: empty-profile
      `;

      jest
        .spyOn(require('./extract'), 'extractDefinition')
        .mockReturnValueOnce([]);

      const result = extractPackageFile(validYAML, 'valid-yaml.yml');
      expect(result).toBeNull();
    });
  });

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

    it('return null if yaml is invalid', () => {
      const result = extractPackageFile(
        codeBlock`
          ----
          apiVersion: "config.projectsveltos.io/v1beta1"
             kind ClusterProfile
          metadata:
          name: prometheus
        `,
        'invalid-yaml.yml',
      );
      expect(result).toBeNull();
    });

    it('return result for double quoted projectsveltos.io apiVersion reference', () => {
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
            depName: 'prometheus-community/prometheus',
            packageName: 'prometheus',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
        ],
      });
    });

    it('return result for single quoted projectsveltos.io apiVersion reference', () => {
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
            depName: 'prometheus-community/prometheus',
            packageName: 'prometheus',
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
            depName: 'prometheus-community/prometheus',
            packageName: 'prometheus',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
          {
            currentValue: 'v3.2.5',
            datasource: 'helm',
            depType: 'Profile',
            depName: 'kyverno/kyverno',
            packageName: 'kyverno',
            registryUrls: ['https://kyverno.github.io/kyverno/'],
          },
          {
            currentValue: 'v3.2.0',
            datasource: 'helm',
            depType: 'Profile',
            depName: 'kyverno/kyverno-policies',
            packageName: 'kyverno-policies',
            registryUrls: ['https://kyverno.github.io/kyverno/'],
          },
          {
            currentValue: '0.7.2',
            datasource: 'docker',
            depType: 'Profile',
            depName: 'oci://registry-1.docker.io/bitnamicharts/vault',
            packageName: 'registry-1.docker.io/bitnamicharts/vault',
          },
          {
            currentValue: '0.5.0',
            datasource: 'docker',
            depType: 'Profile',
            depName: 'oci://custom-registry:443/charts/vault-sidecar',
            packageName: 'custom-registry:443/charts/vault-sidecar',
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
            depName: 'prometheus-community/prometheus',
            packageName: 'prometheus',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
          {
            currentValue: 'v3.2.5',
            datasource: 'helm',
            depType: 'ClusterProfile',
            depName: 'kyverno/kyverno',
            packageName: 'kyverno',
            registryUrls: ['https://kyverno.github.io/kyverno/'],
          },
          {
            currentValue: 'v3.2.0',
            datasource: 'helm',
            depType: 'ClusterProfile',
            depName: 'kyverno/kyverno-policies',
            packageName: 'kyverno-policies',
            registryUrls: ['https://kyverno.github.io/kyverno/'],
          },
          {
            currentValue: '0.7.2',
            datasource: 'docker',
            depType: 'ClusterProfile',
            depName: 'oci://registry-1.docker.io/bitnamicharts/vault',
            packageName: 'registry-1.docker.io/bitnamicharts/vault',
          },
          {
            currentValue: '0.5.0',
            datasource: 'docker',
            depType: 'ClusterProfile',
            depName: 'oci://custom-registry:443/charts/vault-sidecar',
            packageName: 'custom-registry:443/charts/vault-sidecar',
          },
        ],
      });
    });

    it('considers registryAliases', () => {
      const result = extractPackageFile(
        validClusterProfileOCI,
        'clusterprofiles.yml',
        {
          registryAliases: {
            'registry-1.docker.io': 'docker.proxy.test/some/path',
          },
        },
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '0.7.2',
            depName: 'oci://registry-1.docker.io/bitnamicharts/vault',
            packageName: 'docker.proxy.test/some/path/bitnamicharts/vault',
            datasource: 'docker',
            depType: 'ClusterProfile',
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
            depName: 'prometheus-community/prometheus',
            packageName: 'prometheus',
            depType: 'EventTrigger',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
          {
            currentValue: 'v3.2.5',
            datasource: 'helm',
            depName: 'kyverno/kyverno',
            packageName: 'kyverno',
            depType: 'EventTrigger',
            registryUrls: ['https://kyverno.github.io/kyverno/'],
          },
          {
            currentValue: 'v3.2.0',
            datasource: 'helm',
            depName: 'kyverno/kyverno-policies',
            packageName: 'kyverno-policies',
            depType: 'EventTrigger',
            registryUrls: ['https://kyverno.github.io/kyverno/'],
          },
          {
            currentValue: '0.7.2',
            datasource: 'docker',
            depType: 'EventTrigger',
            depName: 'oci://registry-1.docker.io/bitnamicharts/vault',
            packageName: 'registry-1.docker.io/bitnamicharts/vault',
          },
          {
            currentValue: '0.5.0',
            datasource: 'docker',
            depType: 'EventTrigger',
            depName: 'oci://custom-registry:443/charts/vault-sidecar',
            packageName: 'custom-registry:443/charts/vault-sidecar',
          },
        ],
      });
    });
  });
});

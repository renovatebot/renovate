import { codeBlock } from 'common-tags';
import { extractDefinition } from './extract';
import type { ProfileDefinition } from './schema';
import { extractPackageFile } from '.';

const validProfile = codeBlock`
---
apiVersion: config.projectsveltos.io/v1beta1
kind: Profile
metadata:
  name: baseline
spec:
  helmCharts:
  - repositoryURL:    https://prometheus-community.github.io/helm-charts
    repositoryName:   prometheus-community
    chartName:        prometheus-community/prometheus
    chartVersion:     "23.4.0"
  - repositoryURL:    https://kyverno.github.io/kyverno/
    repositoryName:   kyverno
    chartName:        kyverno/kyverno
    chartVersion:     "v3.2.5"
---
apiVersion: config.projectsveltos.io/v1beta1
kind: Profile
metadata:
  name: kyverno
spec:
  helmCharts:
  - repositoryURL:    https://kyverno.github.io/kyverno/
    repositoryName:   kyverno
    chartName:        kyverno/kyverno-policies
    chartVersion:     v3.2.0
    releaseName:      kyverno-latest
    releaseNamespace: kyverno
    helmChartAction:  Install
    values: |
      admissionController:
        replicas: 1
---
apiVersion: config.projectsveltos.io/v1beta1
kind: Profile
metadata:
  name: vault
spec:
  syncMode: Continuous
  helmCharts:
  - repositoryURL:    oci://registry-1.docker.io/bitnamicharts/vault
    repositoryName:   oci-vault
    chartName:        oci://registry-1.docker.io/bitnamicharts/vault
    chartVersion:     0.7.2
  - repositoryURL:    oci://custom-registry:443/charts/vault-sidecar
    repositoryName:   oci-custom-vault
    chartName:        oci://custom-registry:443/charts/vault-sidecar
    chartVersion:     0.5.0
`;
const validClusterProfile = codeBlock`
---
apiVersion: config.projectsveltos.io/v1beta1
kind: ClusterProfile
metadata:
  name: baseline
spec:
  helmCharts:
  - repositoryURL:    https://prometheus-community.github.io/helm-charts
    repositoryName:   prometheus-community
    chartName:        prometheus-community/prometheus
    chartVersion:     "23.4.0"
  - repositoryURL:    https://kyverno.github.io/kyverno/
    repositoryName:   kyverno
    chartName:        kyverno/kyverno
    chartVersion:     "v3.2.5"
---
apiVersion: config.projectsveltos.io/v1beta1
kind: ClusterProfile
metadata:
  name: kyverno
spec:
  helmCharts:
  - repositoryURL:    https://kyverno.github.io/kyverno/
    repositoryName:   kyverno
    chartName:        kyverno/kyverno-policies
    chartVersion:     v3.2.0
    releaseName:      kyverno-latest
    releaseNamespace: kyverno
    helmChartAction:  Install
    values: |
      admissionController:
        replicas: 1
---
apiVersion: config.projectsveltos.io/v1beta1
kind: ClusterProfile
metadata:
  name: vault
spec:
  syncMode: Continuous
  helmCharts:
  - repositoryURL:    oci://registry-1.docker.io/bitnamicharts/vault
    repositoryName:   oci-vault
    chartName:        oci://registry-1.docker.io/bitnamicharts/vault
    chartVersion:     0.7.2
  - repositoryURL:    oci://custom-registry:443/charts/vault-sidecar
    repositoryName:   oci-custom-vault
    chartName:        oci://custom-registry:443/charts/vault-sidecar
    chartVersion:     0.5.0
`;
const validClusterProfileOCI = codeBlock`
---
apiVersion: config.projectsveltos.io/v1beta1
kind: ClusterProfile
metadata:
  name: vault
spec:
  syncMode: Continuous
  helmCharts:
  - repositoryURL:    oci://registry-1.docker.io/bitnamicharts/vault
    repositoryName:   oci-vault
    chartName:        oci://registry-1.docker.io/bitnamicharts/vault
    chartVersion:     0.7.2
`;
const validEventTrigger = codeBlock`
---
apiVersion: lib.projectsveltos.io/v1beta1
kind: EventTrigger
metadata:
  name: baseline
spec:
  helmCharts:
  - repositoryURL:    https://prometheus-community.github.io/helm-charts
    repositoryName:   prometheus-community
    chartName:        prometheus-community/prometheus
    chartVersion:     "23.4.0"
  - repositoryURL:    https://kyverno.github.io/kyverno/
    repositoryName:   kyverno
    chartName:        kyverno/kyverno
    chartVersion:     "v3.2.5"
---
apiVersion: lib.projectsveltos.io/v1beta1
kind: EventTrigger
metadata:
  name: kyverno
spec:
  helmCharts:
  - repositoryURL:    https://kyverno.github.io/kyverno/
    repositoryName:   kyverno
    chartName:        kyverno/kyverno-policies
    chartVersion:     v3.2.0
    releaseName:      kyverno-latest
    releaseNamespace: kyverno
    helmChartAction:  Install
    values: |
      admissionController:
        replicas: 1
---
apiVersion: lib.projectsveltos.io/v1beta1
kind: EventTrigger
metadata:
  name: vault
spec:
  syncMode: Continuous
  helmCharts:
  - repositoryURL:    oci://registry-1.docker.io/bitnamicharts/vault
    repositoryName:   oci-vault
    chartName:        oci://registry-1.docker.io/bitnamicharts/vault
    chartVersion:     0.7.2
  - repositoryURL:    oci://custom-registry:443/charts/vault-sidecar
    repositoryName:   oci-custom-vault
    chartName:        oci://custom-registry:443/charts/vault-sidecar
    chartVersion:     0.5.0
`;
const malformedProfiles = codeBlock`
---
# malformed eventtrigger as the source is null
apiVersion: lib.projectsveltos.io/v1beta1
kind: EventTrigger
spec:
  helmCharts: []
---
# malformed eventtrigger as the source is empty
apiVersion: lib.projectsveltos.io/v1beta1
kind: EventTrigger
spec:
  helmCharts: null
---
# malformed clusterprofile as the sources array is empty
apiVersion: config.projectsveltos.io/v1beta1
kind: ClusterProfile
spec:
  helmCharts: []
---
# malformed clusterprofile as the source is null
apiVersion: config.projectsveltos.io/v1beta1
kind: ClusterProfile
spec:
  helmCharts: null
---
# malformed profile as the sources array is empty
apiVersion: config.projectsveltos.io/v1beta1
kind: Profile
spec:
  helmCharts: []
---
# malformed profile as the source is null
apiVersion: config.projectsveltos.io/v1beta1
kind: Profile
spec:
  helmCharts: null
`;
const randomManifest = codeBlock`
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.14.2
          ports:
            - containerPort: 80
`;

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

    it('return null if YAML is invalid', () => {
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

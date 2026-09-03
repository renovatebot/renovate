import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

const multiDepFile = Fixtures.get('validHelmsfile.yaml');
const otherYamlFile = Fixtures.get('empty.yaml');

describe('modules/manager/helmsman/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null if empty', () => {
      const content = ``;
      const fileName = 'desired_state.yaml';
      const result = extractPackageFile(content, fileName, {});
      expect(result).toBeNull();
    });

    it('returns null if extracting non helmsman yaml file', () => {
      const content = otherYamlFile;
      const fileName = 'requirements.yaml';
      const result = extractPackageFile(content, fileName, {});
      expect(result).toBeNull();
    });

    it('returns null if apps not defined', () => {
      const fileName = 'incorrect.yaml';
      const result = extractPackageFile('incorrect', fileName, {});
      expect(result).toBeNull();
    });

    it('extract deps', () => {
      const fileName = 'helmsman.yaml';
      const result = extractPackageFile(multiDepFile, fileName, {});
      expect(result).not.toBeNull();
      expect(result?.deps).toHaveLength(11);
      expect(result?.deps.filter((value) => value.skipReason)).toHaveLength(5);
      expect(result).toEqual({
        deps: [
          {
            currentValue: '19.0.3',
            datasource: 'helm',
            depName: 'kube-prometheus',
            packageName: 'kube-prometheus-stack',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
          {
            currentValue: '2.6.0',
            datasource: 'helm',
            depName: 'loki',
            packageName: 'loki',
            registryUrls: ['https://grafana.github.io/helm-charts'],
          },
          {
            currentValue: '0.7.7',
            datasource: 'helm',
            depName: 'tempo',
            packageName: 'tempo',
            registryUrls: ['https://grafana.github.io/helm-charts'],
          },
          {
            currentValue: '0.6.0',
            datasource: 'helm',
            depName: 'otlp-collector',
            packageName: 'opentelemetry-collector',
            registryUrls: [
              'https://open-telemetry.github.io/opentelemetry-helm-charts',
            ],
          },
          {
            currentValue: '0.25.0',
            datasource: 'helm',
            depName: 'strimzi-operator',
            packageName: 'strimzi-kafka-operator',
            registryUrls: ['https://strimzi.io/charts/'],
          },
          {
            currentValue: '6.4.0',
            datasource: 'docker',
            depName: 'podinfo',
            packageName: 'ghcr.io/stefanprodan/charts/podinfo',
          },
          {
            datasource: 'helm',
            depName: 'strimzi-operator-missing-version',
            skipReason: 'unspecified-version',
          },
          {
            currentValue: '2.6.0',
            datasource: 'helm',
            depName: 'loki-no-registry-ref',
            packageName: 'loki',
            skipReason: 'no-repository',
          },
          {
            currentValue: '0.7.7',
            datasource: 'helm',
            depName: 'tempo-no-registry-ref',
            skipReason: 'invalid-url',
          },
          {
            currentValue: '19.0.3',
            datasource: 'helm',
            depName: 'kube-prometheus-no-lookup-name',
            skipReason: 'invalid-name',
          },
          {
            currentValue: '0.6.0',
            datasource: 'helm',
            depName: 'otlp-collector-no-chart',
            skipReason: 'invalid-url',
          },
        ],
      });
    });
  });
});

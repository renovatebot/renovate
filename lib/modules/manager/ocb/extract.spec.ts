import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';

describe('modules/manager/ocb/extract', () => {
  describe('extractPackageFile', () => {
    it('run successfully with full example', () => {
      const content = codeBlock`
        dist:
          name: otelcol-custom
          description: Local OpenTelemetry Collector binary
          module: github.com/open-telemetry/opentelemetry-collector
          otelcol_version: 0.40.0
          version: 1.0.0
          output_path: /tmp/dist
        exporters:
          - gomod: github.com/open-telemetry/opentelemetry-collector-contrib/exporter/alibabacloudlogserviceexporter v0.86.0
          - gomod: go.opentelemetry.io/collector/exporter/debugexporter v0.86.0

        extensions:
          - gomod: github.com/open-telemetry/opentelemetry-collector-contrib/extension/healthcheckextension v0.86.0

        receivers:
          - gomod: go.opentelemetry.io/collector/receiver/otlpreceiver v0.86.0

        processors:
          - gomod: go.opentelemetry.io/collector/processor/batchprocessor v0.86.0

        providers:
          - gomod: go.opentelemetry.io/collector/confmap/provider/envprovider v1.0.0-rcv0015
      `;
      const result = extractPackageFile(content, 'builder-config.yaml');
      expect(result?.deps).toEqual([
        {
          currentValue: '0.40.0',
          datasource: 'go',
          depName: 'go.opentelemetry.io/collector',
          depType: 'collector',
          extractVersion: '^v(?<version>\\S+)',
        },
        {
          currentValue: 'v0.86.0',
          datasource: 'go',
          depName:
            'github.com/open-telemetry/opentelemetry-collector-contrib/exporter/alibabacloudlogserviceexporter',
          depType: 'exports',
        },
        {
          currentValue: 'v0.86.0',
          datasource: 'go',
          depName: 'go.opentelemetry.io/collector/exporter/debugexporter',
          depType: 'exports',
        },
        {
          currentValue: 'v0.86.0',
          datasource: 'go',
          depName:
            'github.com/open-telemetry/opentelemetry-collector-contrib/extension/healthcheckextension',
          depType: 'extensions',
        },
        {
          currentValue: 'v0.86.0',
          datasource: 'go',
          depName: 'go.opentelemetry.io/collector/processor/batchprocessor',
          depType: 'processors',
        },
        {
          currentValue: 'v1.0.0-rcv0015',
          datasource: 'go',
          depName: 'go.opentelemetry.io/collector/confmap/provider/envprovider',
          depType: 'providers',
        },
        {
          currentValue: 'v0.86.0',
          datasource: 'go',
          depName: 'go.opentelemetry.io/collector/receiver/otlpreceiver',
          depType: 'receivers',
        },
      ]);
    });

    it('return null for unknown content', () => {
      expect(extractPackageFile('foo', 'bar.yaml')).toBeNull();
    });

    it('return null for content which is not YAML', () => {
      expect(
        extractPackageFile(
          codeBlock`
      myObject:
        aString: value
      ---
      foo: bar
      `,
          'bar.yaml',
        ),
      ).toBeNull();
    });
  });
});

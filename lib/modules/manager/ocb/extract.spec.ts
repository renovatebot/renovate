import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const test = Fixtures.get('valid.yaml');

describe('modules/manager/ocb/extract', () => {
  describe('extractPackageFile', () => {
    it('run successfully with full example', () => {
      const result = extractPackageFile(test, 'builder-config.yaml');
      expect(result?.deps).toEqual([
        {
          currentValue: '0.40.0',
          datasource: 'go',
          depName: 'github.com/open-telemetry/opentelemetry-collector',
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
          depName: 'go.opentelemetry.io/collector/processor/batchprocessor',
          depType: 'processors',
        },
      ]);
    });

    it('return null for unknown content', () => {
      expect(extractPackageFile('foo', 'bar.yaml')).toBeNull();
    });
  });
});

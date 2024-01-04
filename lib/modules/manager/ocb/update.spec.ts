import { codeBlock } from 'common-tags';
import { bumpPackageVersion } from './update';

describe('modules/manager/ocb/update', () => {
  describe('bumpPackageVersion()', () => {
    it('increments with all fields', () => {
      const content = codeBlock`
      dist:
        name: otelcol-custom
        description: Local OpenTelemetry Collector binary
        module: github.com/open-telemetry/opentelemetry-collector
        otelcol_version: 0.40.0
        version: 1.0.0
        output_path: /tmp/dist
    `;
      const expected = content.replace('1.0.0', '1.0.1');

      const { bumpedContent } = bumpPackageVersion(content, '1.0.0', 'patch');
      expect(bumpedContent).toEqual(expected);
    });

    it('increments with double quotes', () => {
      const content = codeBlock`
      dist:
        version: "1.0.0"
    `;
      const expected = content.replace('1.0.0', '1.0.1');

      const { bumpedContent } = bumpPackageVersion(content, '1.0.0', 'patch');
      expect(bumpedContent).toEqual(expected);
    });

    it('increments with single quotes', () => {
      const content = codeBlock`
      dist:
        version: '1.0.0'
    `;
      const expected = content.replace('1.0.0', '1.0.1');

      const { bumpedContent } = bumpPackageVersion(content, '1.0.0', 'patch');
      expect(bumpedContent).toEqual(expected);
    });
  });
});

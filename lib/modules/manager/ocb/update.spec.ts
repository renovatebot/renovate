import { codeBlock } from 'common-tags';
import { bumpPackageVersion } from '.';

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

    it('no ops', () => {
      const content = codeBlock`
      dist:
        version: '0.0.2'
    `;
      const { bumpedContent } = bumpPackageVersion(content, '0.0.1', 'patch');
      expect(bumpedContent).toEqual(content);
    });

    it('updates', () => {
      const content = codeBlock`
      dist:
        version: '0.0.2'
    `;
      const { bumpedContent } = bumpPackageVersion(content, '0.0.1', 'minor');
      const expected = content.replace('0.0.2', '0.1.0');
      expect(bumpedContent).toEqual(expected);
    });

    it('returns content if bumping errors', () => {
      const content = codeBlock`
      dist:
        version: '1.0.0'
    `;
      const { bumpedContent } = bumpPackageVersion(
        content,
        '0.0.2',
        // @ts-expect-error supplying a wrong parameter to trigger an exception
        true,
      );
      expect(bumpedContent).toEqual(content);
    });
  });
});

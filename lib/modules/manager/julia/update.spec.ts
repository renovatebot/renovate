import { codeBlock } from 'common-tags';
import { bumpPackageVersion } from './index.ts';

describe('modules/manager/julia/update', () => {
  describe('bumpPackageVersion()', () => {
    const content = codeBlock`
      name = "Example"
      uuid = "7876af07-990d-54b4-ab0e-23690620f79a"
      version = "0.5.2"

      [compat]
      julia = "1.10"
    `;

    it('increments', () => {
      const { bumpedContent } = bumpPackageVersion(content, '0.5.2', 'patch');

      expect(bumpedContent).toBe(content.replace('0.5.2', '0.5.3'));
    });

    it('no ops', () => {
      const { bumpedContent } = bumpPackageVersion(content, '0.5.1', 'patch');

      expect(bumpedContent).toBe(content);
    });

    it('updates', () => {
      const { bumpedContent } = bumpPackageVersion(content, '0.5.1', 'minor');

      expect(bumpedContent).toBe(content.replace('0.5.2', '0.6.0'));
    });

    it('updates the top-level version only', () => {
      const contentWithVersionDep = codeBlock`
        version = "1.0.1"

        [compat]
        version = "1.0.1"
      `;

      const { bumpedContent } = bumpPackageVersion(
        contentWithVersionDep,
        '1.0.1',
        'patch',
      );

      expect(bumpedContent).toBe(codeBlock`
        version = "1.0.2"

        [compat]
        version = "1.0.1"
      `);
    });

    it('returns content if bumping errors', () => {
      const { bumpedContent } = bumpPackageVersion(
        content,
        '0.5.2',
        true as any,
      );

      expect(bumpedContent).toBe(content);
    });

    it('does not bump version if version is not a semantic version', () => {
      const { bumpedContent } = bumpPackageVersion(content, '0.5', 'patch');

      expect(bumpedContent).toBe(content);
    });
  });
});

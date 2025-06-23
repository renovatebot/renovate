import { codeBlock } from 'common-tags';
import * as projectUpdater from '.';

describe('modules/manager/cargo/update', () => {
  describe('bumpPackageVersion()', () => {
    const content = codeBlock`
      [package]
      name = "test"
      version = "0.0.2"
    `;

    it('increments', () => {
      const { bumpedContent } = projectUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        'patch',
      );
      const expected = content.replace('0.0.2', '0.0.3');
      expect(bumpedContent).toEqual(expected);
    });

    it('no ops', () => {
      const { bumpedContent } = projectUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'patch',
      );
      expect(bumpedContent).toEqual(content);
    });

    it('updates', () => {
      const { bumpedContent } = projectUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'minor',
      );
      const expected = content.replace('0.0.2', '0.1.0');
      expect(bumpedContent).toEqual(expected);
    });

    it('returns content if bumping errors', () => {
      const { bumpedContent } = projectUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        true as any,
      );
      expect(bumpedContent).toEqual(content);
    });

    it('does not bump version if version is not a semantic version', () => {
      const { bumpedContent } = projectUpdater.bumpPackageVersion(
        content,
        '1',
        'patch',
      );
      expect(bumpedContent).toEqual(content);
    });
  });
});

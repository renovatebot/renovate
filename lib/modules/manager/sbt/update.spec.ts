import * as sbtUpdater from '.';

describe('modules/manager/sbt/update', () => {
  describe('.bumpPackageVersion()', () => {
    const content =
      'name := "test"\n' +
      'organization := "test-org"\n' +
      'version := "0.0.2"\n';

    it('increments', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        'patch',
      );

      expect(bumpedContent).toEqual(content.replace('0.0.2', '0.0.3'));
      expect(bumpedContent).not.toEqual(content);
    });

    it('no ops', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'patch',
      );

      expect(bumpedContent).toEqual(content);
    });

    it('updates', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'minor',
      );
      expect(bumpedContent).toEqual(content.replace('0.0.2', '0.1.0'));
      expect(bumpedContent).not.toEqual(content);
    });

    it('returns content if bumping errors', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        true as any,
      );

      expect(bumpedContent).toEqual(content);
    });
  });
});

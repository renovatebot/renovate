import { getName } from '../../../test/util';
import * as sbtUpdater from './update';

describe(getName(__filename), () => {
  describe('.bumpPackageVersion()', () => {
    const content =
      'name := "test"\n' +
      'organization := "test-org"\n' +
      'version := "0.0.2"\n';

    it('increments', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        'patch'
      );

      expect(bumpedContent).toMatchSnapshot();
      expect(bumpedContent).not.toEqual(content);
    });
    it('no ops', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'patch'
      );

      expect(bumpedContent).toEqual(content);
    });
    it('updates', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'minor'
      );

      expect(bumpedContent).toMatchSnapshot();
      expect(bumpedContent).not.toEqual(content);
    });
    it('returns content if bumping errors', () => {
      const { bumpedContent } = sbtUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        true as any
      );

      expect(bumpedContent).toEqual(content);
    });
  });
});

import * as sbtUpdater from './update';

describe('lib/manager/sbt/update', () => {
  describe('.bumpPackageVersion()', () => {
    const content =
      'name := "test"\n' +
      'organization := "test-org"\n' +
      'version := "0.0.2"\n';

    it('increments', () => {
      const res = sbtUpdater.bumpPackageVersion(content, '0.0.2', 'patch');

      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('no ops', () => {
      const res = sbtUpdater.bumpPackageVersion(content, '0.0.1', 'patch');

      expect(res).toEqual(content);
    });
    it('updates', () => {
      const res = sbtUpdater.bumpPackageVersion(content, '0.0.1', 'minor');

      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('returns content if bumping errors', () => {
      const res = sbtUpdater.bumpPackageVersion(content, '0.0.2', true as any);

      expect(res).toEqual(content);
    });
  });
});

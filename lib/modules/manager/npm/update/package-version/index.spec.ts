import * as npmUpdater from '../..';

describe('modules/manager/npm/update/package-version/index', () => {
  describe('.bumpPackageVersion()', () => {
    const content = JSON.stringify({
      name: 'some-package',
      version: '0.0.2',
      dependencies: { chalk: '2.4.2' },
    });

    it('mirrors', () => {
      const { bumpedContent } = npmUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        'mirror:chalk',
      );
      expect(bumpedContent).toMatchSnapshot();
      expect(bumpedContent).not.toEqual(content);
    });

    it('aborts mirror', () => {
      const { bumpedContent } = npmUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        'mirror:a',
      );
      expect(bumpedContent).toEqual(content);
    });

    it('increments', () => {
      const { bumpedContent } = npmUpdater.bumpPackageVersion(
        content,
        '0.0.2',
        'patch',
      );
      expect(bumpedContent).toMatchSnapshot();
      expect(bumpedContent).not.toEqual(content);
    });

    it('no ops', () => {
      const { bumpedContent } = npmUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'patch',
      );
      expect(bumpedContent).toEqual(content);
    });

    it('updates', () => {
      const { bumpedContent } = npmUpdater.bumpPackageVersion(
        content,
        '0.0.1',
        'minor',
      );
      expect(bumpedContent).toMatchSnapshot();
      expect(bumpedContent).not.toEqual(content);
    });

    it('returns content if bumping errors', async () => {
      jest.doMock('semver', () => ({
        inc: () => {
          throw new Error('semver inc');
        },
      }));
      const npmUpdater1 = await import('.');
      const { bumpedContent } = npmUpdater1.bumpPackageVersion(
        content,
        '0.0.2',
        true as any,
      );
      expect(bumpedContent).toEqual(content);
    });
  });
});

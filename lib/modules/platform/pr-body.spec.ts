import { getPrBodyStruct, hashBody } from './pr-body';

describe('modules/platform/pr-body', () => {
  describe('getPrBodyStruct', () => {
    it('returns hash for empty inputs', () => {
      expect(getPrBodyStruct(null)).toEqual({
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });
      expect(getPrBodyStruct(undefined)).toEqual({
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });
      expect(getPrBodyStruct('')).toEqual({
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });
    });

    it('returns rebaseRequested flag', () => {
      expect(getPrBodyStruct('- [x] <!-- rebase-check -->')).toEqual({
        hash: '023952693e1e00a52a71b65d9b4804bca6ca9f215c20f6e029dbf420f322d541',
        rebaseRequested: true,
      });
    });

    it('returns reviewable section', () => {
      expect(getPrBodyStruct('foo<!-- Reviewable:start -->bar')).toEqual({
        hash: hashBody('foo'),
        reviewableSection: '<!-- Reviewable:start -->bar',
      });
    });
  });
});

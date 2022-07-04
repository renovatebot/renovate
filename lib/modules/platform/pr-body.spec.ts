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
      expect(
        getPrBodyStruct(
          'something \n<!--renovate-debug:eyJjcmVhdGVkQnlSZW5vdmF0ZVZlcnNpb24iOiAiMS4yLjEiLCJ1cGRhdGVkQnlSZW5vdmF0ZVZlcnNpb24iOiAiMS4yLjMifQ==-->'
        )
      ).toEqual({
        hash: '3fc9b689459d738f8c88a3a48aa9e33542016b7a4052e001aaa536fca74813cb',
        debugData: {
          createdInVer: '1.2.1',
          updatedInVer: '1.2.3',
        },
      });
      expect(
        getPrBodyStruct(
          'something \n<!--renovate-debug:some-wrong-data-ABCDEFGHIJKLMNOP-->'
        )
      ).toEqual({
        hash: '3fc9b689459d738f8c88a3a48aa9e33542016b7a4052e001aaa536fca74813cb',
      });
    });

    it('hashes ignoring debug info', () => {
      expect(hashBody('foo\n<!--renovate-debug:123-->\n')).toEqual(
        hashBody('foo')
      );
    });

    it('hashes ignoring reviewable section', () => {
      expect(hashBody('foo<!-- Reviewable:start -->bar')).toEqual(
        hashBody('foo')
      );
    });

    it('returns rebaseRequested flag', () => {
      expect(getPrBodyStruct('- [x] <!-- rebase-check -->')).toEqual({
        hash: '023952693e1e00a52a71b65d9b4804bca6ca9f215c20f6e029dbf420f322d541',
        rebaseRequested: true,
      });
    });

    it('strips reviewable section', () => {
      expect(getPrBodyStruct('foo<!-- Reviewable:start -->bar')).toEqual({
        hash: hashBody('foo'),
      });
    });
  });
});

import { toSha256 } from '../../util/hash';
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
          'something \n<!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiAiMS4yLjEiLCJ1cGRhdGVkSW5WZXIiOiAiMS4yLjMifQ==-->',
        ),
      ).toEqual({
        hash: '3fc9b689459d738f8c88a3a48aa9e33542016b7a4052e001aaa536fca74813cb',
        debugData: {
          createdInVer: '1.2.1',
          updatedInVer: '1.2.3',
        },
      });
    });

    it('checks if we reach warning', () => {
      expect(
        getPrBodyStruct(
          'something \n<!--renovate-debug:some-wrong-data-ABCDEFGHIJKLMNOP-->',
        ),
      ).toEqual({
        hash: '3fc9b689459d738f8c88a3a48aa9e33542016b7a4052e001aaa536fca74813cb',
      });
    });

    it('hashes ignoring debug info', () => {
      expect(hashBody('foo\n<!--renovate-debug:123-->\n')).toEqual(
        hashBody('foo'),
      );
    });

    it('hashes ignoring reviewable section', () => {
      expect(hashBody('foo<!-- Reviewable:start -->bar')).toEqual(
        hashBody('foo'),
      );
    });

    it('hashes an undefined body', () => {
      // nullish operator branch coverage
      const hash =
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(hashBody(undefined)).toBe(hash);
    });

    it('returns rebaseRequested=true flag', () => {
      const input = '- [x] <!-- rebase-check -->';
      const hash = hashBody(input);
      expect(getPrBodyStruct(input)).toEqual({
        hash,
        rebaseRequested: true,
      });
    });

    it('returns rebaseRequested=false flag', () => {
      const input = '- [ ] <!-- rebase-check -->';
      const hash = hashBody(input);
      expect(getPrBodyStruct(input)).toEqual({
        hash,
        rebaseRequested: false,
      });
    });

    it('returns rebaseRequested=undefined flag', () => {
      const input = '-  <!-- rebase-check -->';
      const hash = hashBody(input);
      expect(getPrBodyStruct(input)).toEqual({
        hash,
      });
    });

    it('returns raw config hash', () => {
      const config = '{}';
      const rawConfigHash = toSha256(config);
      const input = `<!--renovate-config-hash:${rawConfigHash}-->`;
      const hash = hashBody(input);
      expect(getPrBodyStruct(input)).toEqual({
        hash,
        rawConfigHash,
      });
    });

    it('strips reviewable section', () => {
      expect(getPrBodyStruct('foo<!-- Reviewable:start -->bar')).toEqual({
        hash: hashBody('foo'),
      });
    });
  });
});

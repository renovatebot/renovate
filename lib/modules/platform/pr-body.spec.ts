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
        hash: '82bc749b41acc2a3a3cc398fbfb0717fd05db152b22e48ac7d27f03a06a5dc3a',
        debugData: {
          createdByRenovateVersion: '1.2.1',
          updatedByRenovateVersion: '1.2.3',
        },
      });
    });

    it('returns rebaseRequested flag', () => {
      expect(getPrBodyStruct('- [x] <!-- rebase-check -->')).toEqual({
        hash: '82bc749b41acc2a3a3cc398fbfb0717fd05db152b22e48ac7d27f03a06a5dc3a',
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

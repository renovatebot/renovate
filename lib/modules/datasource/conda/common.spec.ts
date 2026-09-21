import { isPrefixDevUrl } from './common.ts';

describe('modules/datasource/conda/common', () => {
  describe('isPrefixDevUrl', () => {
    it.each`
      registryUrl                             | expected
      ${'https://prefix.dev/conda-forge'}     | ${true}
      ${'https://fast.prefix.dev/my-channel'} | ${true}
      ${'https://prefix.dev'}                 | ${true}
      ${'https://api.anaconda.org/package/'}  | ${false}
      ${'https://prefix.dev.example.com/'}    | ${false}
      ${'not a url'}                          | ${false}
    `('$registryUrl -> $expected', ({ registryUrl, expected }) => {
      expect(isPrefixDevUrl(registryUrl)).toBe(expected);
    });
  });
});

import { extractPerlVersion } from './common';

describe('modules/manager/cpanfile/common', () => {
  describe('extractPerlVersion', () => {
    test.each`
      version         | expected
      ${'5.012005'}   | ${'5.012005'}
      ${`'5.008001'`} | ${'5.008001'}
      ${`"5.008001"`} | ${'5.008001'}
    `('$version', ({ version, expected }) => {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const result = extractPerlVersion(`requires 'perl', ${version};`);
      expect(result).toBe(expected);
    });
  });
});

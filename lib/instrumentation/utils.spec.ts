import { massageThrowable } from './utils';

describe('instrumentation/utils', () => {
  describe('massageThrowable', () => {
    it.each`
      input                | expected
      ${null}              | ${undefined}
      ${undefined}         | ${undefined}
      ${new Error('test')} | ${'test'}
      ${'test'}            | ${'test'}
      ${123}               | ${'123'}
    `('should return $expected for $input', ({ input, expected }) => {
      expect(massageThrowable(input)).toEqual(expected);
    });
  });
});

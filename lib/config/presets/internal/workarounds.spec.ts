import { regEx } from '../../../util/regex';
import { presets } from './workarounds';

describe('config/presets/internal/workarounds', () => {
  describe('bitnamiDockerImageVersioning', () => {
    const versioning = presets.bitnamiDockerImageVersioning.packageRules![0]
      .versioning as string;
    const re = regEx(versioning.substring(6));

    it.each`
      input                     | expected
      ${'latest'}               | ${false}
      ${'20'}                   | ${true}
      ${'20-debian'}            | ${false}
      ${'20-debian-12'}         | ${true}
      ${'1.24'}                 | ${true}
      ${'1.24-debian-12'}       | ${true}
      ${'1.24.0'}               | ${true}
      ${'1.24.0-debian-12'}     | ${true}
      ${'1.24.0-debian-12-r24'} | ${true}
    `('matches("$input") == "$expected"', ({ input, expected }) => {
      expect(re.test(input)).toEqual(expected);
    });
  });
});

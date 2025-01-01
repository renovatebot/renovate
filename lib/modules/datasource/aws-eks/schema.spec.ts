import { EksFilter } from './schema';

describe('modules/datasource/aws-eks/schema', () => {
  describe('EksFilter', () => {
    it.each`
      input                                                  | expected
      ${{ default: 'false' }}                                | ${true}
      ${{ default: 'true' }}                                 | ${true}
      ${{ default: false }}                                  | ${true}
      ${{ default: true }}                                   | ${true}
      ${{}}                                                  | ${true}
      ${{ default: 'false', region: 'eu-west-1' }}           | ${true}
      ${{ region: 'us-gov-west-1', profile: 'gov-profile' }} | ${true}
      ${{ region: 'us-gov-west-not-exist' }}                 | ${false}
      ${{ default: 'abrakadabra' }}                          | ${true}
    `('EksFilter.safeParse("$input") === $expected', ({ input, expected }) => {
      const actual = EksFilter.safeParse(JSON.stringify(input));
      expect(actual.success).toBe(expected);
    });
  });
});

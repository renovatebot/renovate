import { EksAddonsFilter } from './schema';

describe('modules/datasource/aws-eks-addon/schema', () => {
  describe('EksAddonsFilter', () => {
    it.each`
      input                                                         | expected
      ${{ kubernetesVersion: '1.30', addonName: 'kube_proxy' }}     | ${false}
      ${{ kubernetesVersion: '130', addonName: 'kube_proxy' }}      | ${false}
      ${{ addonName: 'kube_proxy', default: 'abrakadabra' }}        | ${false}
      ${{ kubernetesVersion: '1.30' }}                              | ${false}
      ${{ addonName: 'kube-proxy', default: 'false' }}              | ${true}
      ${{ addonName: 'kube-proxy', default: 'true' }}               | ${true}
      ${{ addonName: 'kube-proxy', default: false }}                | ${true}
      ${{ addonName: 'aws-cloudwatch-controller', default: false }} | ${true}
      ${{ addonName: 'aws-cloudwatch-controller', profile: 'abc' }} | ${true}
      ${{ kubernetesVersion: '1.30', addonName: 'vpc-cni' }}        | ${true}
      ${{ addonName: 'vpc-cni' }}                                   | ${true}
    `('safeParse("$input") === $expected', ({ input, expected }) => {
      const actual = EksAddonsFilter.safeParse(JSON.stringify(input));
      expect(actual.success).toBe(expected);
    });
  });
});

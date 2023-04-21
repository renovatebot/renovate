import { KubernetesApiVersioningApi } from './index';

describe('modules/versioning/kubernetes-api/index', () => {
  const versioning = new KubernetesApiVersioningApi();

  test.each`
    version       | expected
    ${'v1'}       | ${true}
    ${'v2'}       | ${true}
    ${'v1alpha1'} | ${false}
    ${'v1beta11'} | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(versioning.isStable(version)).toBe(expected);
  });

  test.each`
    version                          | expected
    ${'v1'}                          | ${true}
    ${'v2'}                          | ${true}
    ${'v10'}                         | ${true}
    ${'v1.0'}                        | ${false}
    ${'1'}                           | ${false}
    ${'2'}                           | ${false}
    ${'10'}                          | ${false}
    ${'1.0'}                         | ${false}
    ${'apps/v1'}                     | ${true}
    ${'telemetry.istio.io/v1alpha1'} | ${true}
    ${'k3d.io/v1alpha2'}             | ${true}
    ${'extensions/v1beta1'}          | ${true}
    ${'apps/v1beta2'}                | ${true}
    ${'autoscaling/v2'}              | ${true}
    ${'acme.cert-manager.io/v1'}     | ${true}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(versioning.isValid(version)).toBe(expected);
  });

  test.each`
    version       | major | minor | patch
    ${'v1'}       | ${1}  | ${0}  | ${0}
    ${'v2'}       | ${2}  | ${0}  | ${0}
    ${'v1alpha1'} | ${1}  | ${0}  | ${0}
    ${'v1alpha2'} | ${1}  | ${0}  | ${0}
    ${'v1beta1'}  | ${1}  | ${0}  | ${0}
    ${'v1beta2'}  | ${1}  | ${0}  | ${0}
  `(
    'getMajor, getMinor, getPatch for "$version"',
    ({ version, major, minor, patch }) => {
      expect(versioning.getMajor(version)).toBe(major);
      expect(versioning.getMinor(version)).toBe(minor);
      expect(versioning.getPatch(version)).toBe(patch);
    }
  );

  test.each`
    version       | other                     | expected
    ${'v1'}       | ${'v1'}                   | ${true}
    ${'v1'}       | ${'v2'}                   | ${false}
    ${'v1'}       | ${'v1alpha1'}             | ${false}
    ${'v1'}       | ${'v1alpha2'}             | ${false}
    ${'v1'}       | ${'v1beta1'}              | ${false}
    ${'v1'}       | ${'v1beta2'}              | ${false}
    ${'v1alpha1'} | ${'v1alpha1'}             | ${true}
    ${'v1alpha1'} | ${'v1alpha2'}             | ${false}
    ${'v1alpha1'} | ${'v1beta1'}              | ${false}
    ${'v1alpha1'} | ${'v1beta2'}              | ${false}
    ${'apps/v1'}  | ${'apps/v1'}              | ${true}
    ${'apps/v1'}  | ${'apps/v2'}              | ${false}
    ${'apps/v1'}  | ${'apps/v1alpha1'}        | ${false}
    ${'apps/v1'}  | ${'apps/v1beta1'}         | ${false}
    ${'apps/v1'}  | ${'autoscaling/v1'}       | ${true}
    ${'apps/v1'}  | ${'autoscaling/v2'}       | ${false}
    ${'apps/v1'}  | ${'autoscaling/v1alpha1'} | ${false}
    ${'apps/v1'}  | ${'autoscaling/v1beta1'}  | ${false}
  `(
    'equals("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(versioning.equals(version, other)).toBe(expected);
    }
  );

  test.each`
    version       | other         | expected
    ${'v1'}       | ${'v1'}       | ${true}
    ${'v1'}       | ${'v2'}       | ${false}
    ${'v1'}       | ${'v1alpha1'} | ${false}
    ${'v1'}       | ${'v1alpha2'} | ${false}
    ${'v1'}       | ${'v1beta1'}  | ${false}
    ${'v1'}       | ${'v1beta2'}  | ${false}
    ${'v1alpha1'} | ${'v1alpha1'} | ${true}
    ${'v1alpha1'} | ${'v1alpha2'} | ${false}
    ${'v1alpha1'} | ${'v1beta1'}  | ${false}
    ${'v1alpha1'} | ${'v1beta2'}  | ${false}
  `(
    'matches("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(versioning.matches(version, other)).toBe(expected);
    }
  );

  test.each`
    version       | other         | expected
    ${'v1'}       | ${'v2'}       | ${false}
    ${'v1'}       | ${'v1alpha1'} | ${true}
    ${'v1'}       | ${'v1beta1'}  | ${true}
    ${'v2'}       | ${'v1beta1'}  | ${true}
    ${'v1alpha1'} | ${'v1alpha2'} | ${false}
    ${'v1beta1'}  | ${'v1alpha1'} | ${true}
    ${'v1beta2'}  | ${'v1beta1'}  | ${true}
  `(
    'isGreaterThan("$version", "$other") === $expected',
    ({ version, other, expected }) => {
      expect(versioning.isGreaterThan(version, other)).toBe(expected);
    }
  );

  it('sorts versions in an ascending order', () => {
    expect(
      [
        'v10',
        'v2',
        'v2beta2',
        'v2beta1',
        'v2alpha2',
        'v2alpha1',
        'v1',
        'v1beta2',
        'v1beta1',
        'v1alpha2',
        'v1alpha1',
      ].sort((a, b) => versioning.sortVersions(a, b))
    ).toEqual([
      'v1alpha1',
      'v1alpha2',
      'v1beta1',
      'v1beta2',
      'v1',
      'v2alpha1',
      'v2alpha2',
      'v2beta1',
      'v2beta2',
      'v2',
      'v10',
    ]);
  });
});

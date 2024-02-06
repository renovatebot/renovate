import { NixPkgsVersioning } from '.';

describe('modules/versioning/nixpkgs/index', () => {
  const versioning = new NixPkgsVersioning();

  it.each`
    version                           | expected
    ${undefined}                      | ${false}
    ${null}                           | ${false}
    ${''}                             | ${false}
    ${'1.2.3'}                        | ${false}
    ${'22.05'}                        | ${false}
    ${'release-22.05'}                | ${true}
    ${'nixos-22.05'}                  | ${true}
    ${'nixos-22.05-small'}            | ${true}
    ${'nixos-22.05-aarch64'}          | ${true}
    ${'nixos-22.05-aarch64-small'}    | ${false}
    ${'nixpkgs-22.05-darwin'}         | ${true}
    ${'nixpkgs-22.05-darwin-aarch64'} | ${false}
    ${'nixos-unstable'}               | ${true}
    ${'nixos-unstable-small'}         | ${true}
    ${'nixpkgs-unstable'}             | ${true}
    ${'nixos-22.05.1234'}             | ${false}
    ${'nixos-22.05-1234'}             | ${false}
    ${'nixos-22.05-unknown'}          | ${false}
    ${'unknown-22.05'}                | ${false}
    ${'nixos-nixpkgs-22.05'}          | ${false}
  `('isValid("$version") === $expected', ({ version, expected }) => {
    expect(versioning.isValid(version)).toBe(expected);
  });

  it.each`
    version                   | expected
    ${undefined}              | ${false}
    ${null}                   | ${false}
    ${''}                     | ${false}
    ${'release-22.05'}        | ${true}
    ${'nixos-22.05'}          | ${true}
    ${'nixos-22.05-small'}    | ${true}
    ${'nixos-22.05-aarch64'}  | ${true}
    ${'nixpkgs-22.05-darwin'} | ${true}
    ${'nixos-unstable'}       | ${false}
    ${'nixos-unstable-small'} | ${false}
    ${'nixpkgs-unstable'}     | ${false}
  `('isStable("$version") === $expected', ({ version, expected }) => {
    expect(versioning.isStable(version)).toBe(expected);
  });

  it.each`
    a                         | b                         | expected
    ${'nixos-22.05'}          | ${'nixos-22.05'}          | ${true}
    ${'nixos-22.05'}          | ${'nixos-21.11'}          | ${false}
    ${'nixos-22.05'}          | ${'nixos-unstable'}       | ${false}
    ${'nixos-unstable'}       | ${'nixos-unstable'}       | ${true}
    ${'nixos-unstable-small'} | ${'nixos-unstable-small'} | ${true}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(versioning.equals(a, b)).toBe(expected);
  });

  it.each`
    versions                                                                                         | expected
    ${['nixos-21.11', 'nixos-22.05', 'nixos-22.05-small', 'nixos-unstable', 'nixos-unstable-small']} | ${['nixos-21.11', 'nixos-22.05', 'nixos-22.05-small', 'nixos-unstable', 'nixos-unstable-small']}
  `(
    '$versions -> sortVersions -> $expected ',
    ({ versions, expected }: { versions: string[]; expected: string[] }) => {
      expect(versions.sort((a, b) => versioning.sortVersions(a, b))).toEqual(
        expected,
      );
    },
  );

  it.each`
    a                | b                        | expected
    ${'nixos-22.05'} | ${'nixos-22.05'}         | ${true}
    ${'nixos-22.05'} | ${'nixpkgs-22.05'}       | ${false}
    ${'nixos-22.05'} | ${'nixos-21.11'}         | ${true}
    ${'nixos-22.05'} | ${'nixos-unstable'}      | ${true}
    ${'nixos-22.05'} | ${'nixos-22.05-small'}   | ${false}
    ${'nixos-22.05'} | ${'nixos-22.05-aarch64'} | ${false}
    ${'nixos-22.05'} | ${'nixos-22.05-darwin'}  | ${false}
  `('equals($a, $b) === $expected', ({ a, b, expected }) => {
    expect(versioning.isCompatible(a, b)).toBe(expected);
  });
});

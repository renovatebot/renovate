import { constructComponentUrls, getBaseSuiteUrl } from './url';

describe('modules/datasource/deb/url', () => {
  it('constructs URLs correctly from registry URL with suite', () => {
    const registryUrl =
      'https://deb.debian.org/debian?suite=stable&components=main,contrib&binaryArch=amd64';
    const expectedUrls = [
      'https://deb.debian.org/debian/dists/stable/main/binary-amd64',
      'https://deb.debian.org/debian/dists/stable/contrib/binary-amd64',
    ];
    const componentUrls = constructComponentUrls(registryUrl);
    expect(componentUrls).toEqual(expectedUrls);
  });

  it('constructs URLs correctly from registry URL with deprecated release', () => {
    const registryUrl =
      'https://deb.debian.org/debian?release=bullseye&components=main,contrib&binaryArch=amd64';
    const expectedUrls = [
      'https://deb.debian.org/debian/dists/bullseye/main/binary-amd64',
      'https://deb.debian.org/debian/dists/bullseye/contrib/binary-amd64',
    ];
    const componentUrls = constructComponentUrls(registryUrl);
    expect(componentUrls).toEqual(expectedUrls);
  });

  it('throws an error if required parameters are missing', () => {
    const registryUrl = 'https://deb.debian.org/debian?components=main,contrib';
    expect(() => constructComponentUrls(registryUrl)).toThrow(
      'Missing required query parameter',
    );
  });

  it('returns the correct suite url', () => {
    const basePackageUrl =
      'https://deb.debian.org/debian/dists/bullseye/main/binary-amd64';
    const expectedUrl = 'https://deb.debian.org/debian/dists/bullseye';

    expect(getBaseSuiteUrl(basePackageUrl)).toBe(expectedUrl);
  });
});

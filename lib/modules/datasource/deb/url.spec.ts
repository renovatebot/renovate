import { constructComponentUrls, getBaseReleaseUrl } from './url';

describe('modules/datasource/deb/url', () => {
  it('constructs URLs correctly from registry URL with suite', () => {
    const registryUrl =
      'https://ftp.debian.org/debian?suite=stable&components=main,contrib&binaryArch=amd64';
    const expectedUrls = [
      'https://ftp.debian.org/debian/dists/stable/main/binary-amd64',
      'https://ftp.debian.org/debian/dists/stable/contrib/binary-amd64',
    ];
    const componentUrls = constructComponentUrls(registryUrl);
    expect(componentUrls).toEqual(expectedUrls);
  });

  it('constructs URLs correctly from registry URL with release', () => {
    const registryUrl =
      'https://ftp.debian.org/debian?release=bullseye&components=main,contrib&binaryArch=amd64';
    const expectedUrls = [
      'https://ftp.debian.org/debian/dists/bullseye/main/binary-amd64',
      'https://ftp.debian.org/debian/dists/bullseye/contrib/binary-amd64',
    ];
    const componentUrls = constructComponentUrls(registryUrl);
    expect(componentUrls).toEqual(expectedUrls);
  });

  it('throws an error if required parameters are missing', () => {
    const registryUrl = 'https://ftp.debian.org/debian?components=main,contrib';
    expect(() => constructComponentUrls(registryUrl)).toThrow(
      'Missing required query parameter',
    );
  });

  it('returns the correct release url', () => {
    const basePackageUrl =
      'https://ftp.debian.org/debian/dists/bullseye/main/binary-amd64';
    const expectedUrl = 'https://ftp.debian.org/debian/dists/bullseye';

    expect(getBaseReleaseUrl(basePackageUrl)).toBe(expectedUrl);
  });
});

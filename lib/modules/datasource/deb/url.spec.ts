import { Http } from '../../../util/http';
import { getPackageUrl } from './index.spec';
import { checkIfModified, constructComponentUrls } from './url';
import * as httpMock from '~test/http-mock';

describe('modules/datasource/deb/url', () => {
  describe('constructComponentUrls', () => {
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
      const registryUrl =
        'https://deb.debian.org/debian?components=main,contrib';
      expect(() => constructComponentUrls(registryUrl)).toThrow(
        'Missing required query parameter',
      );
    });
  });

  describe('checkIfModified', () => {
    const debBaseUrl = 'http://deb.debian.org';

    it('should return true for different status code', async () => {
      httpMock
        .scope(debBaseUrl)
        .head(getPackageUrl('', 'stable', 'non-free', 'amd64'))
        .reply(200);

      await expect(
        checkIfModified(
          getPackageUrl(debBaseUrl, 'stable', 'non-free', 'amd64'),
          new Date(),
          new Http('default'),
        ),
      ).resolves.toBe(true);
    });

    it('should return true if request failed', async () => {
      httpMock
        .scope(debBaseUrl)
        .head(getPackageUrl('', 'stable', 'non-free', 'amd64'))
        .replyWithError('Unexpected Error');

      await expect(
        checkIfModified(
          getPackageUrl(debBaseUrl, 'stable', 'non-free', 'amd64'),
          new Date(),
          new Http('default'),
        ),
      ).resolves.toBe(true);
    });
  });
});

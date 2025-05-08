import { Http } from '../../../util/http';
import { fetchReleaseFile } from './release';
import * as httpMock from '~test/http-mock';

const debBaseUrl = 'http://deb.debian.org';

describe('modules/datasource/deb/release', () => {
  describe('fetchReleaseFile', () => {
    describe('with InRelease and Release file', () => {
      const contentOfInReleaseFile = 'content of InRelease file';

      beforeEach(() => {
        httpMock
          .scope(debBaseUrl)
          .get(`/dists/bullseye/InRelease`)
          .reply(200, contentOfInReleaseFile);
      });

      it('throws an error if no InRelease or Release file is found', async () => {
        const baseReleaseUrl = `${debBaseUrl}/dists/bullseye`;
        const res = await fetchReleaseFile(baseReleaseUrl, new Http('deb'));
        expect(res).toEqual(contentOfInReleaseFile);
      });
    });

    describe('with Release file only', () => {
      const contentOfReleaseFile = 'content of Release file';

      beforeEach(() => {
        httpMock
          .scope(debBaseUrl)
          .get(`/dists/bullseye/InRelease`)
          .reply(404, 'Not Found');
        httpMock
          .scope(debBaseUrl)
          .get(`/dists/bullseye/Release`)
          .reply(200, contentOfReleaseFile);
      });

      it('throws an error if no InRelease or Release file is found', async () => {
        const baseReleaseUrl = `${debBaseUrl}/dists/bullseye`;
        const res = await fetchReleaseFile(baseReleaseUrl, new Http('deb'));

        expect(res).toEqual(contentOfReleaseFile);
      });
    });

    describe('bad server response', () => {
      beforeEach(() => {
        httpMock
          .scope(debBaseUrl)
          .get(`/dists/bullseye/InRelease`)
          .reply(500, 'Bad Gateway');
        httpMock
          .scope(debBaseUrl)
          .get(`/dists/bullseye/Release`)
          .reply(500, 'Bad Gateway');
      });

      it('throws an error if no InRelease or Release file is found', async () => {
        const baseReleaseUrl = `${debBaseUrl}/dists/bullseye`;
        const res = await fetchReleaseFile(baseReleaseUrl, new Http('deb'));

        expect(res).toBeUndefined();
      });
    });
  });
});

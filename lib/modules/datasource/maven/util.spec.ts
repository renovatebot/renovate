import { parseUrl } from '../../../util/url';
import {checkResource, checkS3Resource, downloadMavenXml, downloadS3Protocol} from './util';

describe('modules/datasource/maven/util', () => {
  describe('downloadMavenXml', () => {
    it('returns empty object for unsupported protocols', async () => {
      const res = await downloadMavenXml(
        null,
        parseUrl('unsupported://server.com/')
      );
      expect(res).toEqual({});
    });

    it('returns empty object for invalid URLs', async () => {
      const res = await downloadMavenXml(null, parseUrl('not-a-valid-url'));
      expect(res).toEqual({});
    });
  });

  describe('downloadS3Protocol', () => {
    it('returns null for invalid URLs', async () => {
      const res = await downloadS3Protocol(
        'not-a-valid-url'
      );
      expect(res).toBeNull();
    });

    it('returns emprty object for invalid URLs', async () => {
      const res = await downloadMavenXml(null, parseUrl('not-a-valid-url'));
      expect(res).toEqual({});
    });
  });

  describe('checkResource', () => {
    it('returns not found for unsupported protocols', async () => {
      const res = await checkResource(null, 'unsupported://server.com/');
      expect(res).toBe('not-found');
    });

    it('returns error for invalid URLs', async () => {
      const res = await checkResource(null, 'not-a-valid-url');
      expect(res).toBe('error');
    });
  });

  describe('checkS3Resource', () => {
    it('returns error for invalid URLs', async () => {
      const res = await checkS3Resource('not-a-valid-url');
      expect(res).toBe('error');
    });
  });
});

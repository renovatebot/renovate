import { parseUrl } from '../../../util/url';
import {
  checkResource,
  checkS3Resource,
  downloadMavenXml,
  downloadS3Protocol,
} from './util';

describe('modules/datasource/maven/util', () => {
  describe('downloadMavenXml', () => {
    it('returns empty object for unsupported protocols', async () => {
      const res = await downloadMavenXml(
        null as never, // #7154
        parseUrl('unsupported://server.com/')
      );
      expect(res).toEqual({});
    });

    it('returns empty object for invalid URLs', async () => {
      const res = await downloadMavenXml(
        null as never, // #7154
        null
      );
      expect(res).toEqual({});
    });
  });

  describe('downloadS3Protocol', () => {
    it('returns null for non-S3 URLs', async () => {
      // #7154
      const res = await downloadS3Protocol(parseUrl('http://not-s3.com/')!);
      expect(res).toBeNull();
    });
  });

  describe('checkResource', () => {
    it('returns not found for unsupported protocols', async () => {
      const res = await checkResource(
        null as never, // #7154
        'unsupported://server.com/'
      );
      expect(res).toBe('not-found');
    });

    it('returns error for invalid URLs', async () => {
      const res = await checkResource(
        null as never, // #7154
        'not-a-valid-url'
      );
      expect(res).toBe('error');
    });
  });

  describe('checkS3Resource', () => {
    it('returns error for non-S3 URLs', async () => {
      // #7154
      const res = await checkS3Resource(parseUrl('http://not-s3.com/')!);
      expect(res).toBe('error');
    });
  });
});

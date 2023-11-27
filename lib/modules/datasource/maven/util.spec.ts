import { partial } from '../../../../test/util';
import { HOST_DISABLED } from '../../../constants/error-messages';
import type { Http } from '../../../util/http';
import { parseUrl } from '../../../util/url';
import {
  checkResource,
  checkS3Resource,
  downloadHttpProtocol,
  downloadMavenXml,
  downloadS3Protocol,
} from './util';

describe('modules/datasource/maven/util', () => {
  describe('downloadMavenXml', () => {
    it('returns empty object for unsupported protocols', async () => {
      const res = await downloadMavenXml(
        null as never, // #22198
        parseUrl('unsupported://server.com/'),
      );
      expect(res).toEqual({});
    });

    it('returns empty object for invalid URLs', async () => {
      const res = await downloadMavenXml(
        null as never, // #22198
        null,
      );
      expect(res).toEqual({});
    });
  });

  describe('downloadS3Protocol', () => {
    it('returns null for non-S3 URLs', async () => {
      // #22198
      const res = await downloadS3Protocol(parseUrl('http://not-s3.com/')!);
      expect(res).toBeNull();
    });
  });

  describe('downloadHttpProtocol', () => {
    it('returns empty for HOST_DISABLED error', async () => {
      const http = partial<Http>({
        get: () => Promise.reject({ message: HOST_DISABLED }),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res).toStrictEqual({});
    });

    it('returns empty for host error', async () => {
      const http = partial<Http>({
        get: () => Promise.reject({ code: 'ETIMEDOUT' }),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res).toStrictEqual({});
    });

    it('returns empty for temporal error', async () => {
      const http = partial<Http>({
        get: () => Promise.reject({ code: 'ECONNRESET' }),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res).toStrictEqual({});
    });

    it('returns empty for connection error', async () => {
      const http = partial<Http>({
        get: () => Promise.reject({ code: 'ECONNREFUSED' }),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res).toStrictEqual({});
    });

    it('returns empty for unsupported error', async () => {
      const http = partial<Http>({
        get: () => Promise.reject({ name: 'UnsupportedProtocolError' }),
      });
      const res = await downloadHttpProtocol(http, 'some://');
      expect(res).toStrictEqual({});
    });
  });

  describe('checkResource', () => {
    it('returns not found for unsupported protocols', async () => {
      const res = await checkResource(
        null as never, // #22198
        'unsupported://server.com/',
      );
      expect(res).toBe('not-found');
    });

    it('returns error for invalid URLs', async () => {
      const res = await checkResource(
        null as never, // #22198
        'not-a-valid-url',
      );
      expect(res).toBe('error');
    });
  });

  describe('checkS3Resource', () => {
    it('returns error for non-S3 URLs', async () => {
      // #22198
      const res = await checkS3Resource(parseUrl('http://not-s3.com/')!);
      expect(res).toBe('error');
    });
  });
});

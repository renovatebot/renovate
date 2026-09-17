import { JsDelivrDigestResponse, JsDelivrPackageResponse } from './schema.ts';

describe('modules/datasource/jsdelivr/schema', () => {
  describe('JsDelivrPackageResponse', () => {
    it('returns the expected shape', () => {
      const response = JsDelivrPackageResponse.parse({
        tags: {
          latest: '2.0.0',
          beta: '2.0.0-beta.1',
        },
        versions: [{ version: '2.0.0' }, { version: '1.0.0' }],
      });

      expect(response).toStrictEqual({
        tags: {
          latest: '2.0.0',
          beta: '2.0.0-beta.1',
        },
        versions: [{ version: '2.0.0' }, { version: '1.0.0' }],
      });
    });
  });

  describe('JsDelivrDigestResponse', () => {
    it('returns the expected shape', () => {
      const response = JsDelivrDigestResponse.parse({
        files: [
          {
            name: '/dist/package.min.js',
            hash: 'digest',
          },
        ],
      });

      expect(response).toStrictEqual({
        files: [{ name: '/dist/package.min.js', hash: 'digest' }],
      });
    });
  });
});

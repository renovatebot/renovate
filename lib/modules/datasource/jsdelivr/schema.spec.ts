import { Fixtures } from '~test/fixtures.ts';
import { JsDelivrDigestResponse, JsDelivrPackageResponse } from './schema.ts';

describe('modules/datasource/jsdelivr/schema', () => {
  describe('JsDelivrPackageResponse', () => {
    it('returns the expected shape', () => {
      const rawResponse = Fixtures.get('npm_unscoped_jquery.json');
      const response = JSON.parse(rawResponse);
      expect(JsDelivrPackageResponse.parse(response)).toStrictEqual({
        tags: {
          latest: '4.0.0',
          beta: '4.0.0-rc.2',
        },
        versions: [
          { version: '4.0.0' },
          { version: '4.0.0-rc.2' },
          { version: '4.0.0-rc.1' },
          { version: '4.0.0-beta.2' },
          { version: '4.0.0-beta' },
          { version: '3.7.1' },
        ],
      });
    });
  });

  describe('JsDelivrDigestResponse', () => {
    it('returns the expected shape', () => {
      const rawResponse = Fixtures.get('npm_scoped_popperjs_core_digest.json');
      const response = JSON.parse(rawResponse);
      expect(JsDelivrDigestResponse.parse(response)).toStrictEqual({
        files: [
          {
            name: '/dist/umd/popper.min.js',
            hash: 'whL0tQWoY1Ku1iskqPFvmZ+CHsvmRWx/PIoEvIeWh4I=',
          },
          {
            name: '/dist/umd/popper.min.js.flow',
            hash: 'b/2A0ou/wX++eSKbp3tyP/MHkltx/rRhxxv412BX9Wc=',
          },
          {
            name: '/dist/umd/popper.min.js.map',
            hash: 'S0+2er1a/2gEski6oIbtFIgOgBegAYbfSW6ubDR9DI4=',
          },
          {
            name: '/dist/umd/popper-base.js',
            hash: 'sCJ8HSPPALzBnylZ9MaQCi4Q1yvul1YFRMdNrVDKvLw=',
          },
        ],
      });
    });
  });
});

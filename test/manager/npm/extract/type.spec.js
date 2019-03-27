const {
  mightBeABrowserLibrary,
} = require('../../../../lib/manager/npm/extract/type');

describe('manager/npm/extract/type', () => {
  describe('.mightBeABrowserLibrary()', () => {
    it('is not a library if private', () => {
      const isLibrary = mightBeABrowserLibrary({ private: true });
      expect(isLibrary).toBeFalsy();
    });
    it('is not a library if no main', () => {
      const isLibrary = mightBeABrowserLibrary({});
      expect(isLibrary).toBeFalsy();
    });
    it('is a library if has a main', () => {
      const isLibrary = mightBeABrowserLibrary({ main: 'index.js ' });
      expect(isLibrary).toBeTruthy();
    });
  });
});

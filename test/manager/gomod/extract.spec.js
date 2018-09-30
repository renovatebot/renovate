const fs = require('fs');
const { extractDependencies } = require('../../../lib/manager/gomod/extract');

const gomod1 = fs.readFileSync('test/_fixtures/go/1/go.mod', 'utf8');
const gomod2 = fs.readFileSync('test/_fixtures/go/2/go.mod', 'utf8');

describe('lib/manager/gomod/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractDependencies('nothing here', config)).toBe(null);
    });
    it('extracts single-line requires', () => {
      const res = extractDependencies(gomod1, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(5);
      expect(res.filter(e => e.skipReason).length).toBe(2);
    });
    it('extracts multi-line requires', () => {
      const res = extractDependencies(gomod2, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(58);
      expect(res.filter(e => e.skipReason).length).toBe(4);
    });
  });
});

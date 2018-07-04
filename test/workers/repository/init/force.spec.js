const {
  applyForceConfig,
} = require('../../../../lib/workers/repository/init/force');

describe('workers/repository/init/flatten', () => {
  describe('flattenPackageRules()', () => {
    it('returns empty', () => {
      expect(applyForceConfig({})).toEqual({});
    });
    it('forces', () => {
      const res = applyForceConfig({ a: 1, force: { a: 2, b: 2 } });
      expect(res).toMatchSnapshot();
      expect(res.a).toEqual(2);
      expect(res.b).toEqual(2);
      expect(res.force).toBeUndefined();
    });
  });
});

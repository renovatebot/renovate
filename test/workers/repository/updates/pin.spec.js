const {
  pinDependenciesFirst,
} = require('../../../../lib/workers/repository/updates/pin');

describe('workers/repository/updates/pin', () => {
  describe('pinDependenciesFirst(config)', () => {
    it('puts pinned dependencies first', () => {
      const a = {
        depName: 'a',
        type: 'pin',
        depType: 'devDependencies',
      };
      const b = {
        depName: 'b',
        type: 'pin',
        depType: 'dependencies',
      };
      expect(pinDependenciesFirst(a, b)).toBe(true);
    });
    it('puts pinned anything first', () => {
      const a = {
        depName: 'a',
        type: 'pin',
        depType: 'devDependencies',
      };
      const b = {
        depName: 'b',
        type: 'minor',
        depType: 'dependencies',
      };
      expect(pinDependenciesFirst(a, b)).toBe(false);
    });
  });
});

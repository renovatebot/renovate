const { updateDependency } = require('../../../lib/manager/helm/update');

describe('lib/manager/helm/extract', () => {
  describe('updateDependency()', () => {
    it('returns the same fileContent', () => {
      const fileContent = 'some_content';
      const upgrade = {};
      expect(updateDependency(fileContent, upgrade)).toBe(fileContent);
    });
  });
});

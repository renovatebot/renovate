const { extractPackageFile } = require('../../../lib/manager/helm/extract');

describe('lib/manager/helm/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty array', () => {
      const content = `
      dependencies:
        - name: redis
          version: 0.9.0
          repository: https://kubernetes-charts.storage.googleapis.com/
        - name: postgresql
          version: 0.8.1
          repository: https://kubernetes-charts.storage.googleapis.com/
      `;
      expect(extractPackageFile(content)).not.toBeNull();
      expect(extractPackageFile(content)).toMatchSnapshot();
    });
  });
});

const { extractPackageFile } = require('../../../lib/manager/helm/extract');

describe('lib/manager/helm/extract', () => {
  describe('extractPackageFile()', () => {
    it('parses simple requirements.yaml correctly', () => {
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
    it('returns null if requirements.yaml is invalid', () => {
      const content = `
      Invalid requirements.yaml content.
      dependencies:
      [
      `;
      expect(extractPackageFile(content)).toBeNull();
    });
    it('returns null if requirements.yaml is empty', () => {
      const content = '';
      expect(extractPackageFile(content)).toBeNull();
    });
  });
});

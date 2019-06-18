const { extractPackageFile } = require('../../../lib/manager/helm/extract');

describe('lib/manager/helm/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('parses simple requirements.yaml correctly', async () => {
      platform.getFile.mockReturnValueOnce(`
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      `);
      const content = `
      dependencies:
        - name: redis
          version: 0.9.0
          repository: https://kubernetes-charts.storage.googleapis.com/
        - name: postgresql
          version: 0.8.1
          repository: https://kubernetes-charts.storage.googleapis.com/
      `;
      const fileName = 'requirements.yaml';
      const result = await extractPackageFile(content, fileName);
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
    });
    it('returns null if requirements.yaml is invalid', async () => {
      const content = `
      Invalid requirements.yaml content.
      dependencies:
      [
      `;
      const fileName = 'requirements.yaml';
      const result = await extractPackageFile(content, fileName);
      expect(result).toBeNull();
    });
    it('returns null if requirements.yaml is empty', async () => {
      const content = '';
      const fileName = 'requirements.yaml';
      const result = await extractPackageFile(content, fileName);
      expect(result).toBeNull();
    });
  });
});

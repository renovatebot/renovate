import { updateDependency } from '../../../lib/manager/helm/update';

describe('lib/manager/helm/extract', () => {
  describe('updateDependency()', () => {
    it('returns the same fileContent for undefined upgrade', () => {
      const content = `
      dependencies:
        - name: redis
          version: 0.9.0
          repository: https://kubernetes-charts.storage.googleapis.com/
        - name: postgresql
          version: 0.8.1
          repository: https://kubernetes-charts.storage.googleapis.com/
      `;
      const upgrade = undefined;

      expect(updateDependency(content, upgrade)).toBe(content);
    });
    it('returns the same fileContent for invalid requirements.yaml file', () => {
      const content = `
       Invalid requirements.yaml content.
      `;
      const upgrade = {
        depName: 'redis',
        newValue: '0.11.0',
        repository: 'https://kubernetes-charts.storage.googleapis.com/',
      };
      expect(updateDependency(content, upgrade)).toBe(content);
    });
    it('returns the same fileContent for empty upgrade', () => {
      const content = `
      dependencies:
        - name: redis
          version: 0.9.0
          repository: https://kubernetes-charts.storage.googleapis.com/
        - name: postgresql
          version: 0.8.1
          repository: https://kubernetes-charts.storage.googleapis.com/
      `;
      const upgrade = {};
      expect(updateDependency(content, upgrade)).toBe(content);
    });
    it('upgrades dependency if valid upgrade', () => {
      const content = `
      dependencies:
        - name: redis
          version: 0.9.0
          repository: https://kubernetes-charts.storage.googleapis.com/
        - name: postgresql
          version: 0.8.1
          repository: https://kubernetes-charts.storage.googleapis.com/
      `;
      const upgrade = {
        depName: 'redis',
        newValue: '0.11.0',
        repository: 'https://kubernetes-charts.storage.googleapis.com/',
      };
      expect(updateDependency(content, upgrade)).not.toBe(content);
      expect(updateDependency(content, upgrade)).toMatchSnapshot();
    });
    it('upgrades dependency if version field comes before name field', () => {
      const content = `
      dependencies:
        - version: 0.9.0
          name: redis
          repository: https://kubernetes-charts.storage.googleapis.com/
        - name: postgresql
          version: 0.8.1
          repository: https://kubernetes-charts.storage.googleapis.com/
      `;
      const upgrade = {
        depName: 'redis',
        newValue: '0.11.0',
        repository: 'https://kubernetes-charts.storage.googleapis.com/',
      };
      expect(updateDependency(content, upgrade)).not.toBe(content);
      expect(updateDependency(content, upgrade)).toMatchSnapshot();
    });
    it('upgrades dependency if newValue version value is repeated', () => {
      const content = `
      dependencies:
        - version: 0.9.0
          name: redis
          repository: https://kubernetes-charts.storage.googleapis.com/
        - name: postgresql
          version: 0.9.0
          repository: https://kubernetes-charts.storage.googleapis.com/
      `;
      const upgrade = {
        depName: 'postgresql',
        newValue: '0.11.0',
        repository: 'https://kubernetes-charts.storage.googleapis.com/',
      };
      expect(updateDependency(content, upgrade)).not.toBe(content);
      expect(updateDependency(content, upgrade)).toMatchSnapshot();
    });
  });
});

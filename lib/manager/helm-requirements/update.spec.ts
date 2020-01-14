import { updateDependency } from './update';

describe('lib/manager/helm-requirements/update', () => {
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
      const updateOptions = undefined;

      expect(updateDependency({ fileContent: content, updateOptions })).toBe(
        content
      );
    });
    it('returns the same fileContent for invalid requirements.yaml file', () => {
      const content = `
       Invalid requirements.yaml content.
      `;
      const updateOptions = {
        depName: 'redis',
        newValue: '0.11.0',
        repository: 'https://kubernetes-charts.storage.googleapis.com/',
      };
      expect(updateDependency({ fileContent: content, updateOptions })).toBe(
        content
      );
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
      const updateOptions = {};
      expect(updateDependency({ fileContent: content, updateOptions })).toBe(
        content
      );
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
      const updateOptions = {
        depName: 'redis',
        newValue: '0.11.0',
        repository: 'https://kubernetes-charts.storage.googleapis.com/',
      };
      expect(
        updateDependency({ fileContent: content, updateOptions })
      ).not.toBe(content);
      expect(
        updateDependency({ fileContent: content, updateOptions })
      ).toMatchSnapshot();
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
      const updateOptions = {
        depName: 'redis',
        newValue: '0.11.0',
        repository: 'https://kubernetes-charts.storage.googleapis.com/',
      };
      expect(
        updateDependency({ fileContent: content, updateOptions })
      ).not.toBe(content);
      expect(
        updateDependency({ fileContent: content, updateOptions })
      ).toMatchSnapshot();
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
      const updateOptions = {
        depName: 'postgresql',
        newValue: '0.11.0',
        repository: 'https://kubernetes-charts.storage.googleapis.com/',
      };
      expect(
        updateDependency({ fileContent: content, updateOptions })
      ).not.toBe(content);
      expect(
        updateDependency({ fileContent: content, updateOptions })
      ).toMatchSnapshot();
    });
  });
});

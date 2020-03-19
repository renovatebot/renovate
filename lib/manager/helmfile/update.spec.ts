import { updateDependency } from './update';

describe('lib/manager/helmfile/extract', () => {
  describe('updateDependency()', () => {
    it('returns the same fileContent for undefined upgrade', () => {
      const fileContent = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: fluentd-elasticsearch
          version: 5.3.0
          chart: kiwigrid/fluentd-elasticsearch
      `;
      const upgrade = undefined;

      expect(updateDependency({ fileContent, upgrade })).toBe(fileContent);
    });

    it('returns the same fileContent for invalid helmfile.yaml file', () => {
      const fileContent = `
       Invalid helmfile.yaml content.
      `;
      const upgrade = {
        depName: 'fluentd-elasticsearch',
        newValue: '5.3.0',
        repository: 'https://kiwigrid.github.io',
      };
      expect(updateDependency({ fileContent, upgrade })).toBe(fileContent);
    });

    it('returns the same fileContent for empty upgrade', () => {
      const fileContent = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: fluentd-elasticsearch
          version: 5.3.0
          chart: kiwigrid/fluentd-elasticsearch
      `;
      const upgrade = {};
      expect(updateDependency({ fileContent, upgrade })).toBe(fileContent);
    });

    it('upgrades dependency if valid upgrade', () => {
      const fileContent = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: fluentd-elasticsearch
          version: 5.3.0
          chart: kiwigrid/fluentd-elasticsearch
      `;
      const upgrade = {
        depName: 'fluentd-elasticsearch',
        newValue: '5.3.1',
        repository: 'https://kiwigrid.github.io',
      };
      expect(updateDependency({ fileContent, upgrade })).not.toBe(fileContent);
      expect(updateDependency({ fileContent, upgrade })).toMatchSnapshot();
    });

    it('upgrades dependency if version field comes before name field', () => {
      const fileContent = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - version: 5.3.0
          name: fluentd-elasticsearch
          chart: kiwigrid/fluentd-elasticsearch
      `;
      const upgrade = {
        depName: 'fluentd-elasticsearch',
        newValue: '5.3.1',
        repository: 'https://kiwigrid.github.io',
      };
      expect(updateDependency({ fileContent, upgrade })).not.toBe(fileContent);
      expect(updateDependency({ fileContent, upgrade })).toMatchSnapshot();
    });

    it('upgrades dependency if chart is repeated', () => {
      const fileContent = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io

      releases:
        - name: fluentd-elasticsearch-internal
          version: 5.3.0
          chart: kiwigrid/fluentd-elasticsearch

        - name: nginx-ingress
          version: 1.3.0
          chart: stable/nginx-ingress

        - name: fluentd-elasticsearch-external
          version: 5.3.0
          chart: kiwigrid/fluentd-elasticsearch
      `;
      const upgrade = {
        depName: 'fluentd-elasticsearch',
        newValue: '5.3.1',
        repository: 'https://kiwigrid.github.io',
      };
      expect(updateDependency({ fileContent, upgrade })).not.toBe(fileContent);
      expect(updateDependency({ fileContent, upgrade })).toMatchSnapshot();
    });

    it('Not fail if same version in multiple package', () => {
      const fileContent = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io

      releases:
        - name: fluentd-elasticsearch-internal
          version: 5.3.0
          chart: kiwigrid/fluentd-elasticsearch
        - name: nginx-ingress
          version: 5.3.0
          chart: stable/nginx-ingress
        - name: fluentd-elasticsearch-external
          version: 5.3.0
          chart: kiwigrid/fluentd-elasticsearch
      `;
      const upgrade = {
        depName: 'fluentd-elasticsearch',
        newValue: '5.3.1',
        repository: 'https://kiwigrid.github.io',
      };
      expect(updateDependency({ fileContent, upgrade })).toBe(fileContent);
    });
  });
});

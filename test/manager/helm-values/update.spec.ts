import { updateDependency } from '../../../lib/manager/helm-values/update';

describe('lib/manager/helm-values/update', () => {
  describe('updateDependency()', () => {
    it('returns the same fileContent for undefined upgrade', () => {
      const content = 'someKey: "someValue"';
      const upgrade = undefined;

      expect(updateDependency(content, upgrade)).toBe(content);
    });
    it('returns the same fileContent for invalid values.yaml file', () => {
      const content = `
       Invalid values.yaml content.
      `;
      const upgrade = {
        depName: 'bitnami/postgres-exporter',
        currentValue: '0.7.0-debian-9-r12',
        datasource: 'docker',
        newValue: '0.8.0',
        dockerRepository: 'bitnami/postgres-exporter',
      };
      expect(updateDependency(content, upgrade)).toBe(content);
    });
    // https://github.com/renovatebot/renovate/issues/5298
    it('returns the same fileContent for duplicate key errors', () => {
      const content = `
      replicaCount: 1
      replicaCount: 5
      `;
      const upgrade = {
        depName: 'bitnami/postgres-exporter',
        currentValue: '0.7.0-debian-9-r12',
        datasource: 'docker',
        newValue: '0.8.0',
        dockerRepository: 'bitnami/postgres-exporter',
      };
      expect(updateDependency(content, upgrade)).toBe(content);
    });
    it('returns the same fileContent for empty upgrade', () => {
      const content = 'someKey: "someValue"';
      const upgrade = {};
      expect(updateDependency(content, upgrade)).toBe(content);
    });
    it('returns the same fileContent for null content', () => {
      const content = null;
      const upgrade = {};
      expect(updateDependency(content, upgrade)).toBe(content);
    });
    it('upgrades dependency if valid upgrade', () => {
      const content = `
      image:
        repository: bitnami/postgres-exporter
        tag: 0.7.0-debian-9-r12
      `;
      const upgrade = {
        depName: 'bitnami/postgres-exporter',
        currentValue: '0.7.0-debian-9-r12',
        newValue: '0.8.0',
        dockerRepository: 'bitnami/postgres-exporter',
      };
      expect(updateDependency(content, upgrade)).not.toBe(content);
      expect(updateDependency(content, upgrade)).toMatchSnapshot();
    });
    it('upgrades dependency if newValue version value is repeated', () => {
      const content = `
      db:
        image:
          image:
            registry: docker.io
            repository: bitnami/postgresql
            tag: 11.6.0-debian-9-r0
            some-non-image-related-key: 'with-some-value'
      warehouse:
        image:
          registry: docker.io
          repository: bitnami/postgresql
          tag: 11.6.0-debian-9-r0
          some-non-image-related-key: 'with-some-value'
      `;
      const upgrade = {
        depName: 'docker.io/bitnami/postgresql',
        currentValue: '11.6.0-debian-9-r0',
        newValue: '12.5.0',
        dockerRepository: 'bitnami/postgresql',
      };
      expect(updateDependency(content, upgrade)).not.toBe(content);
      expect(updateDependency(content, upgrade)).toMatchSnapshot();
    });
    it('upgrades correct dependency if registry included', () => {
      const content = `
      db:
        image:
          image:
            repository: bitnami/postgresql
            tag: 11.6.0-debian-9-r0
            some-non-image-related-key: 'with-some-value'
      warehouse:
        image:
          registry: docker.io
          repository: bitnami/postgresql
          tag: 11.6.0-debian-9-r0
          some-non-image-related-key: 'with-some-value'
      `;
      const upgrade = {
        depName: 'docker.io/bitnami/postgresql',
        currentValue: '11.6.0-debian-9-r0',
        newValue: '12.5.0',
        dockerRepository: 'bitnami/postgresql',
      };

      expect(updateDependency(content, upgrade)).not.toBe(content);
      expect(updateDependency(content, upgrade)).toMatchSnapshot();
    });
  });
});

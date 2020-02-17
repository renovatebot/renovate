import { updateDependency } from './update';

describe('lib/manager/helm-values/update', () => {
  describe('updateDependency()', () => {
    it('returns the same fileContent for undefined upgrade', () => {
      const fileContent = 'someKey: "someValue"';
      const upgrade = undefined;

      expect(updateDependency({ fileContent, upgrade })).toBe(fileContent);
    });
    it('returns the same fileContent for invalid values.yaml file', () => {
      const fileContent = `
       Invalid values.yaml content.
      `;
      const upgrade = {
        depName: 'bitnami/postgres-exporter',
        currentValue: '0.7.0-debian-9-r12',
        datasource: 'docker',
        newValue: '0.8.0',
        dockerRepository: 'bitnami/postgres-exporter',
      };
      expect(updateDependency({ fileContent, upgrade })).toBe(fileContent);
    });
    // https://github.com/renovatebot/renovate/issues/5298
    it('returns the same fileContent for duplicate key errors', () => {
      const fileContent = `
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
      expect(updateDependency({ fileContent, upgrade })).toBe(fileContent);
    });
    it('returns the same fileContent for empty upgrade', () => {
      const fileContent = 'someKey: "someValue"';
      const upgrade = {};
      expect(updateDependency({ fileContent, upgrade })).toBe(fileContent);
    });
    it('returns the same fileContent for null content', () => {
      const fileContent = null;
      const upgrade = {};
      expect(updateDependency({ fileContent, upgrade })).toBe(fileContent);
    });
    it('upgrades dependency if valid upgrade', () => {
      const fileContent = `
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
      expect(updateDependency({ fileContent, upgrade })).not.toBe(fileContent);
      expect(updateDependency({ fileContent, upgrade })).toMatchSnapshot();
    });
    it('survives null values of keys', () => {
      const fileContent = `
      empty_key:
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
      expect(updateDependency({ fileContent, upgrade })).not.toBe(fileContent);
      expect(updateDependency({ fileContent, upgrade })).toMatchSnapshot();
    });
    it('upgrades dependency if newValue version value is repeated', () => {
      const fileContent = `
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
      expect(updateDependency({ fileContent, upgrade })).not.toBe(fileContent);
      expect(updateDependency({ fileContent, upgrade })).toMatchSnapshot();
    });
    it('upgrades correct dependency if registry included', () => {
      const fileContent = `
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

      expect(updateDependency({ fileContent, upgrade })).not.toBe(fileContent);
      expect(updateDependency({ fileContent, upgrade })).toMatchSnapshot();
    });
  });
});

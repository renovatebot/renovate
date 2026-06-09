import { Fixtures } from '~test/fixtures.ts';
import { Yaml } from '../../../util/schema-utils/index.ts';
import { HelmRepository } from './schema.ts';

describe('modules/datasource/helm/schema', () => {
  describe('sourceUrl', () => {
    it('works', () => {
      const repo = Yaml.pipe(HelmRepository).parse(Fixtures.get('sample.yaml'));
      expect(repo).toMatchObject({
        airflow: {
          homepage:
            'https://github.com/bitnami/charts/tree/master/bitnami/airflow',
          sourceUrl:
            'https://github.com/bitnami/charts/tree/master/bitnami/airflow',
        },
        coredns: {
          homepage: 'https://coredns.io',
          sourceUrl: 'https://github.com/coredns/helm',
        },
        pgadmin4: {
          homepage: 'https://www.pgadmin.org/',
          sourceUrl: 'https://github.com/rowanruseler/helm-charts',
        },
        'private-chart-github': {
          homepage:
            'https://github.example.com/some-org/charts/tree/master/private-chart',
          sourceUrl:
            'https://github.example.com/some-org/charts/tree/master/private-chart',
        },
        'private-chart-gitlab': {
          homepage:
            'https://gitlab.example.com/some/group/charts/-/tree/master/private-chart',
          sourceUrl:
            'https://gitlab.example.com/some/group/charts/-/tree/master/private-chart',
        },
      });
    });

    it('extracts appVersion from index.yaml', () => {
      const repo = Yaml.pipe(HelmRepository).parse(Fixtures.get('sample.yaml'));
      expect(repo?.airflow?.releases[0].appVersion).toBe('2.1.3');
      expect(repo?.coredns?.releases[0].appVersion).toBe('1.8.4');
      expect(repo?.pgadmin4?.releases[0].appVersion).toBe('5.5');
    });
  });
});

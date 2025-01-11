import { Fixtures } from '../../../../test/fixtures';
import { HelmRepositorySchema } from './schema';

describe('modules/datasource/helm/schema', () => {
  describe('findSourceUrl', () => {
    it('works', () => {
      const repo = HelmRepositorySchema.parse(Fixtures.get('sample.yaml'));
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
  });
});

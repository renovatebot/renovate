import { Fixtures } from '../../../../test/fixtures';
import { parseSingleYaml } from '../../../util/yaml';
import { findSourceUrl } from './common';
import type { HelmRepository } from './types';

// Truncated index.yaml file
const repo = parseSingleYaml<HelmRepository>(Fixtures.get('sample.yaml'));

describe('modules/datasource/helm/common', () => {
  describe('findSourceUrl', () => {
    it.each`
      input                     | output
      ${'airflow'}              | ${'https://github.com/bitnami/charts/tree/master/bitnami/airflow'}
      ${'coredns'}              | ${'https://github.com/coredns/helm'}
      ${'pgadmin4'}             | ${'https://github.com/rowanruseler/helm-charts'}
      ${'private-chart-github'} | ${'https://github.example.com/some-org/charts/tree/master/private-chart'}
      ${'private-chart-gitlab'} | ${'https://gitlab.example.com/some/group/charts/-/tree/master/private-chart'}
      ${'dummy'}                | ${null}
    `(
      '$input -> $output',
      ({ input, output }: { input: string; output: string }) => {
        expect(findSourceUrl(repo.entries[input][0])).toEqual(output);
      },
    );
  });
});

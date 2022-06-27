import { load } from 'js-yaml';
import { loadFixture } from '../../../../test/util';
import { findSourceUrl } from './common';
import type { HelmRepository } from './types';

// Truncated index.yaml file
const repo = load(loadFixture('sample.yaml'), {
  json: true,
}) as HelmRepository;

describe('modules/datasource/helm/common', () => {
  describe('findSourceUrl', () => {
    test.each`
      input         | output
      ${'airflow'}  | ${{ sourceUrl: 'https://github.com/bitnami/charts', sourceDirectory: 'bitnami/airflow' }}
      ${'coredns'}  | ${{ sourceUrl: 'https://github.com/coredns/helm', sourceDirectory: undefined }}
      ${'pgadmin4'} | ${{ sourceUrl: 'https://github.com/rowanruseler/helm-charts', sourceDirectory: undefined }}
      ${'dummy'}    | ${{}}
    `(
      '$input -> $output',
      ({ input, output }: { input: string; output: string }) => {
        expect(findSourceUrl(repo.entries[input][0])).toEqual(output);
      }
    );
  });
});

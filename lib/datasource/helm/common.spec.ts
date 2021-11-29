import { load } from 'js-yaml';
import { loadFixture } from '../../../test/util';
import { findSourceUrl } from './common';
import type { HelmRepository } from './types';

// Truncated index.yaml file
const repo = load(loadFixture('sample.yaml'), {
  json: true,
}) as HelmRepository;

describe('datasource/helm/common', () => {
  describe('findSourceUrl', () => {
    test.each`
      input         | output
      ${'airflow'}  | ${'https://github.com/bitnami/charts'}
      ${'coredns'}  | ${'https://github.com/coredns/helm'}
      ${'pgadmin4'} | ${'https://github.com/rowanruseler/helm-charts'}
      ${'dummy'}    | ${undefined}
    `(
      '$input -> $output',
      ({ input, output }: { input: string; output: string }) => {
        expect(findSourceUrl(repo.entries[input][0])).toEqual(output);
      }
    );
  });
});

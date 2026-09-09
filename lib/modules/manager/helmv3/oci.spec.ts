import { getOciChartDep } from './oci.ts';

describe('modules/manager/helmv3/oci', () => {
  describe('getOciChartDep()', () => {
    it('resolves a chart in an OCI repository', () => {
      expect(getOciChartDep('oci://ghcr.io/charts', 'foo')).toEqual({
        datasource: 'docker',
        packageName: 'ghcr.io/charts/foo',
        pinDigests: false,
      });
    });

    it('resolves a repository which already contains the chart', () => {
      expect(getOciChartDep('oci://ghcr.io/charts/foo')).toEqual({
        datasource: 'docker',
        packageName: 'ghcr.io/charts/foo',
        pinDigests: false,
      });
    });

    it('ignores a trailing slash and a missing oci prefix', () => {
      expect(getOciChartDep('ghcr.io/charts/', 'foo')).toMatchObject({
        packageName: 'ghcr.io/charts/foo',
      });
    });

    it('keeps the registry port', () => {
      expect(
        getOciChartDep('oci://registry.example.com:5000/charts', 'foo'),
      ).toMatchObject({
        packageName: 'registry.example.com:5000/charts/foo',
      });
    });

    it('applies registryAliases', () => {
      expect(
        getOciChartDep('oci://registry.example.com/charts', 'foo', {
          'registry.example.com': 'registry-1.docker.io',
        }),
      ).toMatchObject({
        packageName: 'registry-1.docker.io/charts/foo',
      });
    });

    it('skips references containing variables', () => {
      expect(getOciChartDep('oci://$REGISTRY/charts', 'foo')).toEqual({
        datasource: 'docker',
        packageName: undefined,
        skipReason: 'contains-variable',
        pinDigests: false,
      });
    });
  });
});

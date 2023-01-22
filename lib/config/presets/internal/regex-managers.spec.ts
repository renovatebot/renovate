import { Fixtures } from '../../../../test/fixtures';
import { regexMatches } from '../../../../test/util';
import { extractPackageFile } from '../../../modules/manager/regex';
import { presets } from './regex-managers';

describe('config/presets/internal/regex-managers', () => {
  describe('Update `_VERSION` variables in Dockerfiles', () => {
    const regexManager = presets['dockerfileVersions'].regexManagers?.[0];
    const fileName = 'Dockerfile';

    it(`find dependencies in ${fileName}`, () => {
      const res = extractPackageFile(
        Fixtures.get(fileName),
        fileName,
        regexManager!
      );
      expect(res).toMatchSnapshot();
    });

    describe('matches regexes patterns', () => {
      test.each([
        ['Dockerfile', true],
        ['foo/Dockerfile', true],
        ['foo/bar/Dockerfile', true],
        ['Dockerfile-foo', true],
        ['Dockerfilefoo', true],
        ['foo/Dockerfile-foo', true],
        ['foo-Dockerfile', false],
      ])('regexMatches("%s") === %s', (path, expected) => {
        expect(regexMatches(path, regexManager!.fileMatch)).toBe(expected);
      });
    });
  });

  describe('Update `_VERSION` environment variables in GitHub Actions files', () => {
    const regexManager = presets['githubActionsVersions'].regexManagers?.[0];
    const fileName = 'github-workflow.yaml';

    it(`find dependencies in ${fileName}`, () => {
      const res = extractPackageFile(
        Fixtures.get(fileName),
        fileName,
        regexManager!
      );
      expect(res).toMatchSnapshot();
    });

    describe('matches regexes patterns', () => {
      test.each([
        ['.github/workflows/foo.yaml', true],
        ['.github/workflows/bar.yml', true],
        ['.github/workflows/foo/bar.yaml', true],
        ['.github/actions/foo.yaml', true],
        ['.github/actions/foo.yml', true],
        ['.github/actions/foo/bar.yaml', true],
        ['foo.yaml', false],
        ['foo.yml', false],
        ['.github/foo.yml', false],
        ['.github/workflowsa/foo.yml', false],
        ['.github/workflows/foo.json', false],
        ['.github/workflows/foo.yamlo', false],
      ])('regexMatches("%s") === %s', (path, expected) => {
        expect(regexMatches(path, regexManager!.fileMatch)).toBe(expected);
      });
    });
  });

  describe('Update `appVersion` value in Helm chart Chart.yaml', () => {
    const regexManager = presets['helmChartYamlAppVersions'].regexManagers?.[0];
    const fileName = 'Chart.yaml';

    it(`find dependencies in ${fileName}`, () => {
      const res = extractPackageFile(
        Fixtures.get(fileName),
        fileName,
        regexManager!
      );
      expect(res).toMatchSnapshot();
    });

    describe('matches regexes patterns', () => {
      test.each([
        ['Chart.yaml', true],
        ['foo/Chart.yaml', true],
        ['foo/bar/Chart.yaml', true],
        ['Chart.yml', false],
        ['Chart.json', false],
        ['Chart.yamlo', false],
        ['Charto.yaml', false],
      ])('regexMatches("%s") === %s', (path, expected) => {
        expect(regexMatches(path, regexManager!.fileMatch)).toBe(expected);
      });
    });
  });
});

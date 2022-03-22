import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('modules/manager/github-actions/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple docker image lines from yaml configuration file', () => {
      const res = extractPackageFile(Fixtures.get('workflow_1.yml'));
      expect(res.deps).toMatchSnapshot();
      expect(res.deps.filter((d) => d.datasource === 'docker')).toHaveLength(2);
    });
    it('extracts multiple action tag lines from yaml configuration file', () => {
      const res = extractPackageFile(Fixtures.get('workflow_2.yml'));
      expect(res.deps).toMatchSnapshot();
      expect(
        res.deps.filter((d) => d.datasource === 'github-tags')
      ).toHaveLength(8);
    });
    it('extracts tag line with double quotes', () => {
      const res = extractPackageFile(Fixtures.get('workflow_3.yml'));
      expect(res.deps).toMatchSnapshot([
        {
          currentValue: 'v0.13.1',
          datasource: 'github-tags',
          depName: 'pascalgn/automerge-action',
          depType: 'action',
          replaceString: '"pascalgn/automerge-action@v0.13.1"',
          versioning: 'docker',
        },
      ]);
    });
    it('extracts action tag line with digest pinning and a comment from a yaml file', () => {
      const res = extractPackageFile(Fixtures.get('workflow_4.yml'));
      expect(res.deps).toMatchSnapshot([
        {
          currentValue: 'v2.3.5',
          datasource: 'github-tags',
          depName: 'actions/checkout',
          depType: 'action',
          replaceString:
            'actions/checkout@1e204e9a9253d643386038d443f96446fa156a97 # renovate: tag=v2.3.5',
          versioning: 'docker',
        },
      ]);
    });
    it('extracts action line with a comment & double quotes from a yaml file', () => {
      const res = extractPackageFile(Fixtures.get('workflow_6.yml'));
      expect(res.deps).toMatchSnapshot([
        {
          currentValue: 'v1.1.2',
          datasource: 'github-tags',
          depName: 'actions/checkout',
          depType: 'action',
          replaceString: '"actions/checkout@v1.1.2"',
          versioning: 'docker',
        },
      ]);
    });
  });
});

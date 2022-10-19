import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const gomod1 = Fixtures.get('1/go.mod');
const gomod2 = Fixtures.get('2/go.mod');

describe('modules/manager/gomod/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts single-line requires', () => {
      const res = extractPackageFile(gomod1)?.deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(8);
      expect(res?.filter((e) => e.skipReason)).toHaveLength(1);
      expect(res?.filter((e) => e.depType === 'replace')).toHaveLength(1);
    });

    it('extracts multi-line requires', () => {
      const res = extractPackageFile(gomod2)?.deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(58);
      expect(res?.filter((e) => e.skipReason)).toHaveLength(0);
    });

    it('extracts replace directives from multi-line and single line', () => {
      const goMod = `
module github.com/renovate-tests/gomod
go 1.18
replace golang.org/x/foo => github.com/pravesht/gocql v0.0.0
replace (
      k8s.io/client-go => k8s.io/client-go v0.21.9
      )
replace (
  k8s.io/cloud-provider => k8s.io/cloud-provider v0.17.3
  k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.17.3 // indirect
  k8s.io/code-generator => k8s.io/code-generator v0.17.3
)`;
      const res = extractPackageFile(goMod);
      expect(res).toEqual({
        deps: [
          {
            managerData: {
              lineNumber: 2,
            },
            depName: 'go',
            depType: 'golang',
            currentValue: '1.18',
            datasource: 'golang-version',
            versioning: 'npm',
            rangeStrategy: 'replace',
          },
          {
            managerData: {
              lineNumber: 3,
            },
            depName: 'github.com/pravesht/gocql',
            depType: 'replace',
            currentValue: 'v0.0.0',
            datasource: 'go',
          },
          {
            managerData: {
              lineNumber: 5,
              multiLine: true,
            },
            depName: 'k8s.io/client-go',
            depType: 'replace',
            currentValue: 'v0.21.9',
            datasource: 'go',
          },
          {
            managerData: {
              lineNumber: 8,
              multiLine: true,
            },
            depName: 'k8s.io/cloud-provider',
            depType: 'replace',
            currentValue: 'v0.17.3',
            datasource: 'go',
          },
          {
            managerData: {
              lineNumber: 10,
              multiLine: true,
            },
            depName: 'k8s.io/code-generator',
            depType: 'replace',
            currentValue: 'v0.17.3',
            datasource: 'go',
          },
        ],
      });
    });
  });
});

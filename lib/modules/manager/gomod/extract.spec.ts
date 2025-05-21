import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';

const gomod1 = Fixtures.get('1/go-mod');
const gomod2 = Fixtures.get('2/go-mod');

describe('modules/manager/gomod/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts single-line requires', () => {
      const res = extractPackageFile(gomod1)?.deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(12);
      expect(res?.filter((e) => e.depType === 'require')).toHaveLength(9);
      expect(res?.filter((e) => e.depType === 'indirect')).toHaveLength(1);
      expect(res?.filter((e) => e.skipReason)).toHaveLength(2);
      expect(res?.filter((e) => e.depType === 'replace')).toHaveLength(2);
    });

    it('extracts multi-line requires', () => {
      const res = extractPackageFile(gomod2)?.deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(59);
      expect(res?.filter((e) => e.skipReason)).toHaveLength(0);
      expect(res?.filter((e) => e.depType === 'indirect')).toHaveLength(1);
    });

    it('ignores empty spaces in multi-line requires', () => {
      const goMod = codeBlock`
        module github.com/renovate-tests/gomod
        go 1.19
        require (
        	cloud.google.com/go v0.45.1

        	github.com/Microsoft/go-winio v0.4.15-0.20190919025122-fc70bd9a86b5 // indirect
        )
      `;
      const res = extractPackageFile(goMod)?.deps;
      expect(res).toHaveLength(3);
    });

    it('extracts replace directives from multi-line and single line', () => {
      const goMod = codeBlock`
        module github.com/renovate-tests/gomod
        go 1.23
        replace golang.org/x/foo => github.com/pravesht/gocql v0.0.0
        replace (
              k8s.io/client-go => k8s.io/client-go v0.21.9
              )
        replace (
          k8s.io/cloud-provider => k8s.io/cloud-provider v0.17.3
          k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.17.3 // indirect
          k8s.io/code-generator => k8s.io/code-generator v0.17.3
        )
      `;
      const res = extractPackageFile(goMod);
      expect(res).toEqual({
        deps: [
          {
            managerData: {
              lineNumber: 1,
            },
            depName: 'go',
            depType: 'golang',
            currentValue: '1.23',
            datasource: 'golang-version',
            versioning: 'go-mod-directive',
          },
          {
            managerData: {
              lineNumber: 2,
            },
            depName: 'github.com/pravesht/gocql',
            depType: 'replace',
            currentValue: 'v0.0.0',
            datasource: 'go',
          },
          {
            managerData: {
              lineNumber: 4,
              multiLine: true,
            },
            depName: 'k8s.io/client-go',
            depType: 'replace',
            currentValue: 'v0.21.9',
            datasource: 'go',
          },
          {
            managerData: {
              lineNumber: 7,
              multiLine: true,
            },
            depName: 'k8s.io/cloud-provider',
            depType: 'replace',
            currentValue: 'v0.17.3',
            datasource: 'go',
          },
          {
            managerData: {
              lineNumber: 8,
              multiLine: true,
            },
            depName: 'k8s.io/cluster-bootstrap',
            depType: 'indirect',
            enabled: false,
            currentValue: 'v0.17.3',
            datasource: 'go',
          },
          {
            managerData: {
              lineNumber: 9,
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

    // https://go.dev/doc/modules/gomod-ref#exclude
    it('ignores exclude directives from multi-line and single line', () => {
      const goMod = codeBlock`
        module github.com/renovate-tests/gomod

        exclude github.com/pravesht/gocql v0.0.0

        exclude (
              k8s.io/client-go v0.21.9
              )
        exclude (
          k8s.io/cloud-provider v0.17.3
          k8s.io/cluster-bootstrap v0.17.3 // indirect
          k8s.io/code-generator v0.17.3
        )
      `;
      const res = extractPackageFile(goMod);
      expect(res).toBeNull();
    });

    it('extracts the toolchain directive', () => {
      const goMod = codeBlock`
        module github.com/renovate-tests/gomod
        go 1.23
        toolchain go1.23.3
        replace golang.org/x/foo => github.com/pravesht/gocql v0.0.0
      `;
      const res = extractPackageFile(goMod);
      expect(res).toEqual({
        deps: [
          {
            managerData: {
              lineNumber: 1,
            },
            depName: 'go',
            depType: 'golang',
            currentValue: '1.23',
            datasource: 'golang-version',
            versioning: 'go-mod-directive',
          },
          {
            managerData: {
              lineNumber: 2,
            },
            depName: 'go',
            depType: 'toolchain',
            currentValue: '1.23.3',
            datasource: 'golang-version',
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
        ],
      });
    });

    it('extracts single-line tool directives', () => {
      const goMod = codeBlock`
        require github.com/oapi-codegen/oapi-codegen/v2 v2.4.1 // indirect
        tool github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen
      `;
      const res = extractPackageFile(goMod);
      expect(res).toEqual({
        deps: [
          {
            datasource: 'go',
            depName: 'github.com/oapi-codegen/oapi-codegen/v2',
            depType: 'indirect',
            currentValue: 'v2.4.1',
            managerData: { lineNumber: 0 },
          },
        ],
      });
    });

    it('extracts multi-line tool directives', () => {
      const goMod = codeBlock`
        require github.com/oapi-codegen/oapi-codegen/v2 v2.4.1 // indirect
        tool (
          github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen
        )
      `;
      const res = extractPackageFile(goMod);
      expect(res).toEqual({
        deps: [
          {
            datasource: 'go',
            depName: 'github.com/oapi-codegen/oapi-codegen/v2',
            depType: 'indirect',
            currentValue: 'v2.4.1',
            managerData: { lineNumber: 0 },
          },
        ],
      });
    });
  });

  it('extracts tool directives with required modules', () => {
    const goMod = codeBlock`
        require github.com/oapi-codegen/oapi-codegen/v2 v2.4.1
        tool github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen
      `;
    const res = extractPackageFile(goMod);
    expect(res).toEqual({
      deps: [
        {
          datasource: 'go',
          depName: 'github.com/oapi-codegen/oapi-codegen/v2',
          depType: 'require',
          currentValue: 'v2.4.1',
          managerData: { lineNumber: 0 },
        },
      ],
    });
  });

  it('extracts tool directives of sub-modules', () => {
    const goMod = codeBlock`
        require (
          github.com/foo/bar v1.2.3
          github.com/foo/bar/sub1/sub2 v4.5.6 // indirect
          github.com/foo/bar/sub1 v7.8.9 // indirect
          github.com/foo/bar/sub1/sub2/cmd/hell v10.11.12 // indirect
        )
        tool github.com/foo/bar/sub1/sub2/cmd/hello
      `;
    const res = extractPackageFile(goMod);
    expect(res).toEqual({
      deps: [
        {
          datasource: 'go',
          depName: 'github.com/foo/bar',
          depType: 'require',
          currentValue: 'v1.2.3',
          managerData: { lineNumber: 1, multiLine: true },
        },
        {
          datasource: 'go',
          depName: 'github.com/foo/bar/sub1/sub2',
          depType: 'indirect',
          currentValue: 'v4.5.6',
          managerData: { lineNumber: 2, multiLine: true },
        },
        {
          datasource: 'go',
          depName: 'github.com/foo/bar/sub1',
          depType: 'indirect',
          currentValue: 'v7.8.9',
          enabled: false,
          managerData: { lineNumber: 3, multiLine: true },
        },
        {
          datasource: 'go',
          depName: 'github.com/foo/bar/sub1/sub2/cmd/hell',
          depType: 'indirect',
          currentValue: 'v10.11.12',
          enabled: false,
          managerData: { lineNumber: 4, multiLine: true },
        },
      ],
    });
  });

  it('extracts tool directives with exact match', () => {
    const goMod = codeBlock`
        require github.com/foo/bar v1.2.3 // indirect
        tool github.com/foo/bar
      `;
    const res = extractPackageFile(goMod);
    expect(res).toEqual({
      deps: [
        {
          datasource: 'go',
          depName: 'github.com/foo/bar',
          depType: 'indirect',
          currentValue: 'v1.2.3',
          managerData: { lineNumber: 0 },
        },
      ],
    });
  });

  it('extracts tool directives with no matching dependencies', () => {
    const goMod = codeBlock`
        tool github.com/foo/bar/sub/cmd/hello
      `;
    const res = extractPackageFile(goMod);
    expect(res).toBeNull();
  });

  /**
   *
   * https://go.dev/doc/modules/gomod-ref#retract
   * https://go.dev/doc/modules/gomod-ref#godebug
   */
  it('ignores directives unrelated to dependencies', () => {
    const goMod = codeBlock`
        module github.com/renovate-tests/gomod

        godebug asynctimerchan=0

        godebug (
          default=go1.21
          panicnil=1
        )

        retract v3.0.0

        retract [v2.0.0,v2.0.5] // Build broken on some platforms.

        retract (
            v1.0.0 // Published accidentally.
            v1.0.1 // Contains retractions only.
        )
      `;
    const res = extractPackageFile(goMod);
    expect(res).toBeNull();
  });
});

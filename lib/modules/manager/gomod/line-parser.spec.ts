import { parseLine } from './line-parser';

describe('modules/manager/gomod/line-parser', () => {
  it('should return null for invalid input', () => {
    expect(parseLine('invalid')).toBeNull();
  });

  it('should parse go version', () => {
    const line = 'go 1.23';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: '1.23',
      datasource: 'golang-version',
      depName: 'go',
      depType: 'golang',
      versioning: 'go-mod-directive',
    });
  });

  it('should skip invalid go version', () => {
    const line = 'go invalid';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: 'invalid',
      datasource: 'golang-version',
      depName: 'go',
      depType: 'golang',
      skipReason: 'invalid-version',
      versioning: 'go-mod-directive',
    });
  });

  it('should parse toolchain version', () => {
    const line = 'toolchain go1.23';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: '1.23',
      datasource: 'golang-version',
      depName: 'go',
      depType: 'toolchain',
      skipReason: 'invalid-version',
    });
  });

  it('should skip invalid toolchain version', () => {
    const line = 'toolchain go-invalid';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: '-invalid',
      datasource: 'golang-version',
      depName: 'go',
      depType: 'toolchain',
      skipReason: 'invalid-version',
    });
  });

  it('should parse require definition', () => {
    const line = 'require foo/foo v1.2';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: 'v1.2',
      datasource: 'go',
      depName: 'foo/foo',
      depType: 'require',
      skipReason: 'invalid-version',
    });
  });

  it('should parse require definition with pseudo-version', () => {
    const line = 'require foo/foo v0.0.0-20210101000000-000000000000';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentDigest: '000000000000',
      currentValue: 'v0.0.0-20210101000000-000000000000',
      datasource: 'go',
      depName: 'foo/foo',
      depType: 'require',
      digestOneAndOnly: true,
      versioning: 'loose',
    });
  });

  it('should parse require multi-line', () => {
    const line = '        foo/foo v1.2';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: 'v1.2',
      datasource: 'go',
      depName: 'foo/foo',
      depType: 'require',
      managerData: {
        multiLine: true,
      },
      skipReason: 'invalid-version',
    });
  });

  it('should parse require definition with quotes', () => {
    const line = 'require "foo/foo" v1.2';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: 'v1.2',
      datasource: 'go',
      depName: 'foo/foo',
      depType: 'require',
      skipReason: 'invalid-version',
    });
  });

  it('should parse go modules without paths - 1', () => {
    const line = 'require tailscale.com v1.72.0';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: 'v1.72.0',
      datasource: 'go',
      depName: 'tailscale.com',
      depType: 'require',
    });
  });

  it('should parse go modules without paths - 2', () => {
    const line = 'require foo.tailscale.com v1.72.0';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: 'v1.72.0',
      datasource: 'go',
      depName: 'foo.tailscale.com',
      depType: 'require',
    });
  });

  it('should parse require multi-line definition with quotes', () => {
    const line = '        "foo/foo" v1.2';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: 'v1.2',
      datasource: 'go',
      depName: 'foo/foo',
      depType: 'require',
      managerData: {
        multiLine: true,
      },
      skipReason: 'invalid-version',
    });
  });

  it('should parse require definition with indirect dependency', () => {
    const line = 'require foo/foo v1.2 // indirect';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: 'v1.2',
      datasource: 'go',
      depName: 'foo/foo',
      depType: 'indirect',
      enabled: false,
      skipReason: 'invalid-version',
    });
  });

  it('should parse require multi-line definition with indirect dependency', () => {
    const line = '        foo/foo v1.2 // indirect';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: 'v1.2',
      datasource: 'go',
      depName: 'foo/foo',
      depType: 'indirect',
      enabled: false,
      managerData: {
        multiLine: true,
      },
      skipReason: 'invalid-version',
    });
  });

  it('should parse replace definition', () => {
    const line = 'replace foo/foo => bar/bar';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      datasource: 'go',
      depName: 'bar/bar',
      depType: 'replace',
      skipReason: 'unspecified-version',
    });
  });

  it('should parse replace multi-line definition', () => {
    const line = '        foo/foo => bar/bar';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      datasource: 'go',
      depName: 'bar/bar',
      depType: 'replace',
      managerData: {
        multiLine: true,
      },
      skipReason: 'unspecified-version',
    });
  });

  it('should parse replace definition with quotes', () => {
    const line = 'replace "foo/foo" => "bar/bar"';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      datasource: 'go',
      depName: 'bar/bar',
      depType: 'replace',
      skipReason: 'unspecified-version',
    });
  });

  it('should parse replace multi-line definition with quotes', () => {
    const line = '        "foo/foo" => "bar/bar"';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      datasource: 'go',
      depName: 'bar/bar',
      depType: 'replace',
      managerData: {
        multiLine: true,
      },
      skipReason: 'unspecified-version',
    });
  });

  it('should parse replace definition with version', () => {
    const line = 'replace foo/foo => bar/bar v1.2';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: 'v1.2',
      datasource: 'go',
      depName: 'bar/bar',
      depType: 'replace',
      skipReason: 'invalid-version',
    });
  });

  it('should parse replace definition with pseudo-version', () => {
    const line =
      'replace foo/foo => bar/bar v0.0.0-20210101000000-000000000000';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentDigest: '000000000000',
      currentValue: 'v0.0.0-20210101000000-000000000000',
      datasource: 'go',
      depName: 'bar/bar',
      depType: 'replace',
      digestOneAndOnly: true,
      versioning: 'loose',
    });
  });

  it('should parse replace indirect definition', () => {
    const line = 'replace foo/foo => bar/bar v1.2 // indirect';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: 'v1.2',
      datasource: 'go',
      depName: 'bar/bar',
      depType: 'indirect',
      enabled: false,
      skipReason: 'invalid-version',
    });
  });

  it('should parse replace multi-line definition with version', () => {
    const line = '        foo/foo => bar/bar v1.2';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      currentValue: 'v1.2',
      datasource: 'go',
      depName: 'bar/bar',
      depType: 'replace',
      managerData: {
        multiLine: true,
      },
      skipReason: 'invalid-version',
    });
  });

  it('should parse replace definition pointing to relative local path', () => {
    const line = 'replace foo/foo => ../bar';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      datasource: 'go',
      depName: '../bar',
      depType: 'replace',
      skipReason: 'local-dependency',
    });
  });

  it('should parse replace definition pointing to absolute local path', () => {
    const line = 'replace foo/foo => /bar';
    const res = parseLine(line);
    expect(res).toStrictEqual({
      datasource: 'go',
      depName: '/bar',
      depType: 'replace',
      skipReason: 'local-dependency',
    });
  });
});

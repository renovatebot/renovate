import { parse } from './parser';

describe('modules/manager/bazel/parser', () => {
  it('parses rules input', () => {
    const input = `go_repository(
      deps = ["foo", "bar"],
      name = "com_github_google_uuid",
      importpath = "github.com/google/uuid",
      commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e",
    )`;

    const res = parse(input);
    expect(res).toEqual({
      meta: [
        { data: { length: 3, offset: 30 }, path: [0, 'deps', 0] },
        { data: { length: 3, offset: 37 }, path: [0, 'deps', 1] },
        { data: { length: 22, offset: 58 }, path: [0, 'name'] },
        { data: { length: 22, offset: 103 }, path: [0, 'importpath'] },
        { data: { length: 40, offset: 144 }, path: [0, 'commit'] },
        { data: { length: input.length, offset: 0 }, path: [0] },
      ],
      targets: [
        {
          commit: 'dec09d789f3dba190787f8b4454c7d3c936fed9e',
          deps: ['foo', 'bar'],
          importpath: 'github.com/google/uuid',
          name: 'com_github_google_uuid',
          rule: 'go_repository',
        },
      ],
    });
  });

  it('parses maybe input', () => {
    const input = `maybe(
      go_repository,
      deps = ["foo", "bar"],
      name = "com_github_google_uuid",
      importpath = "github.com/google/uuid",
      commit = "dec09d789f3dba190787f8b4454c7d3c936fed9e",
    )`;

    const res = parse(input);
    expect(res).toEqual({
      meta: [
        { data: { length: 3, offset: 43 }, path: [0, 'deps', 0] },
        { data: { length: 3, offset: 50 }, path: [0, 'deps', 1] },
        { data: { length: 22, offset: 71 }, path: [0, 'name'] },
        { data: { length: 22, offset: 116 }, path: [0, 'importpath'] },
        { data: { length: 40, offset: 157 }, path: [0, 'commit'] },
        { data: { length: input.length, offset: 0 }, path: [0] },
      ],
      targets: [
        {
          commit: 'dec09d789f3dba190787f8b4454c7d3c936fed9e',
          deps: ['foo', 'bar'],
          importpath: 'github.com/google/uuid',
          name: 'com_github_google_uuid',
          rule: 'go_repository',
        },
      ],
    });
  });

  it('parses multiple archives', () => {
    const input = `
      http_archive(
          name = "aspect_rules_js",
          sha256 = "db9f446752fe4100320cf8487e8fd476b9af0adf6b99b601bcfd70b289bb0598",
          strip_prefix = "rules_js-1.1.2",
          url = "https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz",
      )
      http_archive(
        name = "rules_nodejs",
        sha256 = "5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064",
        urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz"],
      )`;

    const res = parse(input);
    expect(res).toEqual({
      meta: [
        { data: { length: 15, offset: 39 }, path: [0, 'name'] },
        { data: { length: 64, offset: 77 }, path: [0, 'sha256'] },
        { data: { length: 14, offset: 170 }, path: [0, 'strip_prefix'] },
        { data: { length: 72, offset: 204 }, path: [0, 'url'] },
        { data: { length: 279, offset: 7 }, path: [0] },
        { data: { length: 12, offset: 323 }, path: [0, 1, 'name'] },
        { data: { length: 64, offset: 356 }, path: [0, 1, 'sha256'] },
        { data: { length: 97, offset: 440 }, path: [0, 1, 'urls', 0] },
        { data: { length: 255, offset: 293 }, path: [1] },
      ],
      targets: [
        {
          rule: 'http_archive',
          name: 'aspect_rules_js',
          sha256:
            'db9f446752fe4100320cf8487e8fd476b9af0adf6b99b601bcfd70b289bb0598',
          strip_prefix: 'rules_js-1.1.2',
          url: 'https://github.com/aspect-build/rules_js/archive/refs/tags/v1.1.2.tar.gz',
        },
        {
          rule: 'http_archive',
          name: 'rules_nodejs',
          sha256:
            '5aef09ed3279aa01d5c928e3beb248f9ad32dde6aafe6373a8c994c3ce643064',
          urls: [
            'https://github.com/bazelbuild/rules_nodejs/releases/download/5.5.3/rules_nodejs-core-5.5.3.tar.gz',
          ],
        },
      ],
    });
  });
});

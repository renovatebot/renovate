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
});

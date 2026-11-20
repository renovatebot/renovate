import { matchRegexOrGlob } from '../../../util/string-match.ts';
import { defaultConfig } from './index.ts';

// Mirror how the extractor decides which files a manager owns
// (see getMatchingFiles in workers/repository/extract/file-match).
function isBufFile(file: string): boolean {
  return defaultConfig.managerFilePatterns.some((pattern) =>
    matchRegexOrGlob(file, pattern),
  );
}

describe('modules/manager/buf/index', () => {
  it.each`
    file                         | matches
    ${'buf.lock'}                | ${true}
    ${'buf.gen.yaml'}            | ${true}
    ${'buf.gen.yml'}             | ${true}
    ${'buf.gen.go.yaml'}         | ${true}
    ${'buf.gen.rust.yaml'}       | ${true}
    ${'sub/dir/buf.gen.go.yaml'} | ${true}
    ${'buf.yaml'}                | ${false}
    ${'mybuf.gen.yaml'}          | ${false}
    ${'buf.genxyaml'}            | ${false}
  `('matches $file -> $matches', ({ file, matches }) => {
    expect(isBufFile(file)).toBe(matches);
  });
});

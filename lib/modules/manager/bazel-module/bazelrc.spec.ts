import { codeBlock } from 'common-tags';
import {
  BazelOption,
  CommandEntry,
  ImportEntry,
  expandWorkspacePath,
  parse,
  read,
  sanitizeOptions,
} from './bazelrc';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

function mockReadLocalFile(files: Record<string, string | null>) {
  fs.readLocalFile.mockImplementation((file): Promise<any> => {
    let content: string | null = '';
    if (file in files) {
      content = files[file];
    } else {
      return Promise.reject(new Error(`Unexpected file: ${file}`));
    }
    return Promise.resolve(content);
  });
}

function mockIsValidLocalPath(files: Record<string, boolean>) {
  fs.isValidLocalPath.mockImplementation((file: string): boolean => {
    return file in files;
  });
}

describe('modules/manager/bazel-module/bazelrc', () => {
  describe('BazelOption', () => {
    it.each`
      a                                       | expArgs
      ${'--show_timestamps'}                  | ${[['show_timestamps', undefined]]}
      ${'--host_jvm_args=-XX:-UseParallelGC'} | ${[['host_jvm_args', '-XX:-UseParallelGC']]}
      ${'--host_jvm_args='}                   | ${[['host_jvm_args', '']]}
      ${'--jobs 600'}                         | ${[['jobs', '600']]}
    `('parse($a)', ({ a, expArgs }) => {
      const exp = (expArgs as [string, string | undefined][]).map(
        (args) => new BazelOption(...args),
      );
      const result = BazelOption.parse(a);
      expect(result).toEqual(exp);
    });
  });

  describe('CommandEntry', () => {
    it('getOption', () => {
      const opt0 = new BazelOption('show_timestamps');
      const opt1 = new BazelOption('keep_going');
      const opt2 = new BazelOption('jobs', '600');
      const cmdEntry = new CommandEntry('build', [opt0, opt1, opt2]);
      expect(cmdEntry.getOption('does_not_exist')).toBeUndefined();
      expect(cmdEntry.getOption(opt0.name)).toEqual(opt0);
      expect(cmdEntry.getOption(opt2.name)).toEqual(opt2);
    });
  });

  it('parse', () => {
    const input = codeBlock`
        # Bob's Bazel option defaults

        startup --host_jvm_args=-XX:-UseParallelGC
        import /home/bobs_project/bazelrc
        build --show_timestamps --keep_going --jobs 600
        build --color=yes
        query --keep_going

        # Definition of --config=memcheck
        build:memcheck --strip=never --test_timeout=3600

        try-import %workspace%/local.bazelrc
      `;
    const res = parse(input);
    expect(res).toEqual([
      new CommandEntry('startup', [
        new BazelOption('host_jvm_args', '-XX:-UseParallelGC'),
      ]),
      new ImportEntry('/home/bobs_project/bazelrc', false),
      new CommandEntry('build', [
        new BazelOption('show_timestamps'),
        new BazelOption('keep_going'),
        new BazelOption('jobs', '600'),
      ]),
      new CommandEntry('build', [new BazelOption('color', 'yes')]),
      new CommandEntry('query', [new BazelOption('keep_going')]),
      new CommandEntry(
        'build',
        [
          new BazelOption('strip', 'never'),
          new BazelOption('test_timeout', '3600'),
        ],
        'memcheck',
      ),
      new ImportEntry('%workspace%/local.bazelrc', true),
    ]);
  });

  describe('read()', () => {
    it('when .bazelrc does not exist', async () => {
      mockReadLocalFile({ '.bazelrc': null });
      mockIsValidLocalPath({ '.bazelrc': true });
      const result = await read('.');
      expect(result).toHaveLength(0);
    });

    it('when .bazelrc has invalid lines', async () => {
      mockReadLocalFile({
        '.bazelrc': codeBlock`
          // This is not a valid comment
          build --show_timestamps --keep_going --jobs 600
          `,
      });
      mockIsValidLocalPath({ '.bazelrc': true });
      const result = await read('.');
      expect(result).toEqual([
        new CommandEntry('build', [
          new BazelOption('show_timestamps'),
          new BazelOption('keep_going'),
          new BazelOption('jobs', '600'),
        ]),
      ]);
    });

    it('when .bazelrc has no imports', async () => {
      mockReadLocalFile({
        '.bazelrc': codeBlock`
          # This comment should be ignored
          build --show_timestamps --keep_going --jobs 600
          build --color=yes
          `,
      });
      mockIsValidLocalPath({ '.bazelrc': true });
      const result = await read('.');
      expect(result).toEqual([
        new CommandEntry('build', [
          new BazelOption('show_timestamps'),
          new BazelOption('keep_going'),
          new BazelOption('jobs', '600'),
        ]),
        new CommandEntry('build', [new BazelOption('color', 'yes')]),
      ]);
    });

    it('when .bazelrc has import and try-import, try-import exists', async () => {
      mockReadLocalFile({
        '.bazelrc': codeBlock`
          import %workspace%/shared.bazelrc
          try-import %workspace%/local.bazelrc
          `,
        'shared.bazelrc': codeBlock`
          build --show_timestamps
          `,
        'local.bazelrc': codeBlock`
          build --color=yes
          `,
      });
      mockIsValidLocalPath({
        '.bazelrc': true,
        'local.bazelrc': true,
        'shared.bazelrc': true,
      });
      const result = await read('.');
      expect(result).toEqual([
        new CommandEntry('build', [new BazelOption('show_timestamps')]),
        new CommandEntry('build', [new BazelOption('color', 'yes')]),
      ]);
    });

    it('when .bazelrc has import and try-import, try-import does not exist', async () => {
      mockReadLocalFile({
        '.bazelrc': codeBlock`
          build --jobs 600
          try-import %workspace%/local.bazelrc
          `,
        'local.bazelrc': null,
      });
      mockIsValidLocalPath({ '.bazelrc': true });
      const result = await read('.');
      expect(result).toEqual([
        new CommandEntry('build', [new BazelOption('jobs', '600')]),
      ]);
    });

    it('when .bazelrc multi-level import', async () => {
      mockReadLocalFile({
        '.bazelrc': codeBlock`
          import %workspace%/shared.bazelrc
          build --jobs 600
          `,
        'shared.bazelrc': codeBlock`
          import %workspace%/foo.bazelrc
          `,
        'foo.bazelrc': codeBlock`
          build --show_timestamps
          `,
      });
      mockIsValidLocalPath({
        '.bazelrc': true,
        'foo.bazelrc': true,
        'shared.bazelrc': true,
      });
      const result = await read('.');
      expect(result).toEqual([
        new CommandEntry('build', [new BazelOption('show_timestamps')]),
        new CommandEntry('build', [new BazelOption('jobs', '600')]),
      ]);
    });

    it('when bazlerc files recursively import each other', async () => {
      mockReadLocalFile({
        '.bazelrc': codeBlock`
          import %workspace%/shared.bazelrc
          build --jobs 600
          `,
        'shared.bazelrc': codeBlock`
          import %workspace%/foo.bazelrc
          `,
        'foo.bazelrc': codeBlock`
          import %workspace%/shared.bazelrc
          `,
      });
      mockIsValidLocalPath({
        '.bazelrc': true,
        'foo.bazelrc': true,
        'shared.bazelrc': true,
      });
      expect.assertions(1);
      await expect(read('.')).rejects.toEqual(
        new Error(
          'Attempted to read a bazelrc multiple times. file: shared.bazelrc',
        ),
      );
    });

    it('when .bazelrc refers to a non-local file', async () => {
      mockReadLocalFile({
        '.bazelrc': codeBlock`
          import /non-local.bazelrc
          build --jobs 600
          `,
      });
      mockIsValidLocalPath({
        '.bazelrc': true,
      });
      const result = await read('.');
      expect(result).toEqual([
        new CommandEntry('build', [new BazelOption('jobs', '600')]),
      ]);
    });

    it('when bazelrc has %workspace% paths in options', async () => {
      const workspaceDir = '/tmp/workspace';
      mockReadLocalFile({
        '/tmp/workspace/.bazelrc': codeBlock`
          build --output_base=%workspace%/bazel-out
          `,
      });
      mockIsValidLocalPath({
        '/tmp/workspace/.bazelrc': true,
        '/tmp/workspace/bazel-out': true,
      });
      const result = await read(workspaceDir);
      expect(result).toEqual([
        new CommandEntry('build', [
          new BazelOption('output_base', '/tmp/workspace/bazel-out'),
        ]),
      ]);
    });

    it('when bazelrc has %workspace% paths in imported files', async () => {
      const workspaceDir = '/tmp/workspace';
      mockReadLocalFile({
        '/tmp/workspace/.bazelrc': codeBlock`
          import %workspace%/shared.bazelrc
          `,
        '/tmp/workspace/shared.bazelrc': codeBlock`
          build --output_base=%workspace%/bazel-out
          build --test_output=%workspace%/test-results
          `,
      });
      mockIsValidLocalPath({
        '/tmp/workspace/.bazelrc': true,
        '/tmp/workspace/shared.bazelrc': true,
        '/tmp/workspace/bazel-out': true,
        '/tmp/workspace/test-results': true,
      });
      const result = await read(workspaceDir);
      expect(result).toEqual([
        new CommandEntry('build', [
          new BazelOption('output_base', '/tmp/workspace/bazel-out'),
        ]),
        new CommandEntry('build', [
          new BazelOption('test_output', '/tmp/workspace/test-results'),
        ]),
      ]);
    });
  });

  describe('expandWorkspacePath', () => {
    it('should return original value if no workspace path', () => {
      expect(expandWorkspacePath('--some-option', '/workspace')).toBe(
        '--some-option',
      );
    });

    it('should expand valid workspace path', () => {
      fs.isValidLocalPath.mockImplementation((path: string) => {
        return path === '/workspace' || path === '/workspace/some/path';
      });
      const workspaceDir = '/workspace';
      const value = '%workspace%/some/path';
      const expected = '/workspace/some/path';
      expect(expandWorkspacePath(value, workspaceDir)).toBe(expected);
    });

    it('should throw error for invalid workspace path', () => {
      const workspaceDir = '/workspace';
      const value = '%workspace%/../../outside';
      expect(expandWorkspacePath(value, workspaceDir)).toBeNull();
    });
  });

  describe('sanitizeOptions', () => {
    it('should handle options without values', () => {
      const options = [new BazelOption('build')];
      expect(sanitizeOptions(options, '/workspace')).toEqual(options);
    });

    it('should expand valid workspace paths', () => {
      fs.isValidLocalPath.mockImplementation((path: string) => {
        return (
          path === '/workspace' ||
          path === '/workspace/some/path' ||
          path === '/workspace/other/path'
        );
      });
      const options = [
        new BazelOption('build', '%workspace%/some/path'),
        new BazelOption('test', '%workspace%/other/path'),
      ];
      const result = sanitizeOptions(options, '/workspace');
      expect(result).toEqual([
        new BazelOption('build', '/workspace/some/path'),
        new BazelOption('test', '/workspace/other/path'),
      ]);
    });

    it('should throw error for invalid workspace paths', () => {
      const options = [
        new BazelOption('build', '%workspace%/valid/path'),
        new BazelOption('test', '%workspace%/../../invalid'),
      ];
      expect(sanitizeOptions(options, '/workspace')).toEqual([]);
    });
  });
});

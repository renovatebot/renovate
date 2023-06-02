import { codeBlock } from 'common-tags';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as fs from '../../../util/fs';
import { BazelOption, CommandEntry, ImportEntry, parse, read } from './bazelrc';

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('lib/modules/manager/bazel-module/__fixtures__'),
};

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
        (args) => new BazelOption(...args)
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
        'memcheck'
      ),
      new ImportEntry('%workspace%/local.bazelrc', true),
    ]);
  });

  describe('read()', () => {
    beforeEach(() => {
      GlobalConfig.set(adminConfig);
    });

    afterEach(() => {
      GlobalConfig.reset();
    });

    it('when .bazelrc does not exist', async () => {
      const result = await read('.');
      expect(result).toHaveLength(0);
    });

    it('when .bazelrc has invalid lines', async () => {
      const bazelrc = codeBlock`
        // This is not a valid comment
        build --show_timestamps --keep_going --jobs 600
        `;
      jest.spyOn(fs, 'readLocalFile').mockResolvedValueOnce(bazelrc);
      const result = await read('bazelrc/invalid-bazelrc');
      expect(result).toEqual([
        new CommandEntry('build', [
          new BazelOption('show_timestamps'),
          new BazelOption('keep_going'),
          new BazelOption('jobs', '600'),
        ]),
      ]);
    });

    it('when .bazelrc has no imports', async () => {
      const bazelrc = codeBlock`
        # This comment should be ignored
        build --show_timestamps --keep_going --jobs 600
        build --color=yes
        `;
      jest.spyOn(fs, 'readLocalFile').mockResolvedValueOnce(bazelrc);
      const result = await read('bazelrc/no-imports');
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
      const result = await read('bazelrc/single-level-imports');
      expect(result).toEqual([
        new CommandEntry('build', [new BazelOption('show_timestamps')]),
        new CommandEntry('build', [new BazelOption('color', 'yes')]),
      ]);
    });

    it('when .bazelrc has import and try-import, try-import does not exist', async () => {
      const result = await read('bazelrc/try-import-does-not-exist');
      expect(result).toEqual([
        new CommandEntry('build', [new BazelOption('jobs', '600')]),
      ]);
    });

    it('when .bazelrc multi-level import', async () => {
      const result = await read('bazelrc/multi-level-imports');
      expect(result).toEqual([
        new CommandEntry('build', [new BazelOption('show_timestamps')]),
        new CommandEntry('build', [new BazelOption('jobs', '600')]),
      ]);
    });
  });
});

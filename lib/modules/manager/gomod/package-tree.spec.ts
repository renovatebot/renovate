import { codeBlock } from 'common-tags';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { getTransitiveDependentModules } from './package-tree';
import { scm } from '~test/util';

vi.mock('fs-extra');
vi.mock('../../../util/fs');

const fs = vi.hoisted(() => ({
  readLocalFile: vi.fn(),
}));

vi.mock('../../../util/fs', () => fs);

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('/tmp/repo'),
};

const sampleGoMod = codeBlock`
  module github.com/renovate-tests/gomod1

  go 1.19

  require github.com/pkg/errors v0.7.0
  require github.com/aws/aws-sdk-go v1.15.21
`;

const goModWithReplace = codeBlock`
  module github.com/renovate-tests/gomod-with-replace

  go 1.19

  require github.com/pkg/errors v0.7.0
  require github.com/renovate-tests/gomod1 v1.0.0

  replace github.com/renovate-tests/gomod1 => ../gomod1
`;

const goModWithCircularA = codeBlock`
  module github.com/renovate-tests/circular-a

  go 1.19

  require github.com/renovate-tests/circular-b v1.0.0

  replace github.com/renovate-tests/circular-b => ../circular-b
`;

const goModWithCircularB = codeBlock`
  module github.com/renovate-tests/circular-b

  go 1.19

  require github.com/renovate-tests/circular-a v1.0.0

  replace github.com/renovate-tests/circular-a => ../circular-a
`;

describe('modules/manager/gomod/package-tree', () => {
  describe('getTransitiveDependentModules()', () => {
    beforeEach(() => {
      GlobalConfig.set(adminConfig);
      vi.clearAllMocks();
    });

    afterEach(() => {
      GlobalConfig.reset();
    });

    it('returns self for single project', async () => {
      scm.getFileList.mockResolvedValue(['go.mod']);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);

      expect(await getTransitiveDependentModules('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);
    });

    it('handles dependency relationships with tree-like and linear references', async () => {
      const goModMultiple = codeBlock`
        module github.com/renovate-tests/gomod-multiple

        go 1.19

        require github.com/renovate-tests/gomod1 v1.0.0
        require github.com/renovate-tests/gomod2 v1.0.0

        replace github.com/renovate-tests/gomod1 => ../gomod1
        replace github.com/renovate-tests/gomod2 => ../gomod2
      `;

      const goModTreeLike = codeBlock`
        module github.com/renovate-tests/tree-like

        go 1.19

        require github.com/renovate-tests/gomod1 v1.0.0

        replace github.com/renovate-tests/gomod1 => ../gomod1
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'gomod-with-replace/go.mod',
        'gomod-multiple/go.mod',
        'tree-like/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithReplace);
      fs.readLocalFile.mockResolvedValueOnce(goModMultiple);
      fs.readLocalFile.mockResolvedValueOnce(goModTreeLike);

      // Test linear dependency chain: gomod1 -> multiple dependents
      expect(await getTransitiveDependentModules('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'gomod-with-replace/go.mod' },
        { isLeaf: true, name: 'gomod-multiple/go.mod' },
        { isLeaf: true, name: 'tree-like/go.mod' },
      ]);

      // Test tree-like reference: leaf nodes
      expect(await getTransitiveDependentModules('tree-like/go.mod')).toEqual([
        { isLeaf: true, name: 'tree-like/go.mod' },
      ]);
    });

    it('returns empty array on circular reference', async () => {
      scm.getFileList.mockResolvedValue([
        'circular-a/go.mod',
        'circular-b/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(goModWithCircularA);
      fs.readLocalFile.mockResolvedValueOnce(goModWithCircularB);

      expect(await getTransitiveDependentModules('circular-a/go.mod')).toEqual(
        [],
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'Circular reference detected in Go modules replace directives',
      );
    });

    it('handles invalid file content gracefully', async () => {
      scm.getFileList.mockResolvedValue(['go.mod']);

      // Test null content
      fs.readLocalFile.mockResolvedValueOnce(null);
      expect(await getTransitiveDependentModules('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);

      // Test empty content
      fs.readLocalFile.mockResolvedValueOnce('');
      expect(await getTransitiveDependentModules('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);

      // Test invalid syntax
      fs.readLocalFile.mockResolvedValueOnce('invalid go.mod content');
      expect(await getTransitiveDependentModules('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);
    });

    it('handles replace directives with version specifiers and comments', async () => {
      const goModWithVersionReplace = codeBlock`
        module github.com/renovate-tests/version-replace

        go 1.19

        require github.com/renovate-tests/gomod1 v1.0.0

        replace github.com/renovate-tests/gomod1 => ../gomod1 v1.2.3 // local development
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'version-replace/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithVersionReplace);

      expect(await getTransitiveDependentModules('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'version-replace/go.mod' },
      ]);
    });

    it('ignores remote replace directives', async () => {
      const goModWithRemoteReplace = codeBlock`
        module github.com/renovate-tests/remote-replace

        go 1.19

        require github.com/renovate-tests/gomod1 v1.0.0

        replace github.com/renovate-tests/gomod1 => github.com/fork/gomod1 v1.0.0
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'remote-replace/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithRemoteReplace);

      expect(await getTransitiveDependentModules('gomod1/go.mod')).toEqual([
        { isLeaf: true, name: 'gomod1/go.mod' },
      ]);
    });

    it('handles multiline replace blocks', async () => {
      const goModWithMultilineReplace = codeBlock`
        module github.com/renovate-tests/multiline-replace

        go 1.19

        require github.com/renovate-tests/gomod1 v1.0.0
        require github.com/renovate-tests/gomod2 v1.0.0

        replace (
          github.com/renovate-tests/gomod1 => ../gomod1
          github.com/renovate-tests/gomod2 => ../gomod2
        )
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'multiline-replace/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithMultilineReplace);

      expect(await getTransitiveDependentModules('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'multiline-replace/go.mod' },
      ]);
    });

    it('handles complex dependency chains', async () => {
      const goModLevel2 = codeBlock`
        module github.com/renovate-tests/level2

        go 1.19

        require github.com/renovate-tests/gomod-with-replace v1.0.0

        replace github.com/renovate-tests/gomod-with-replace => ../gomod-with-replace
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'gomod-with-replace/go.mod',
        'level2/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithReplace);
      fs.readLocalFile.mockResolvedValueOnce(goModLevel2);

      expect(await getTransitiveDependentModules('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: false, name: 'gomod-with-replace/go.mod' },
        { isLeaf: true, name: 'level2/go.mod' },
      ]);

      expect(
        await getTransitiveDependentModules('gomod-with-replace/go.mod'),
      ).toEqual([{ isLeaf: true, name: 'gomod-with-replace/go.mod' }]);
    });

    it('handles complex dependency chains with already visited packages', async () => {
      const goModLevel2 = codeBlock`
        module github.com/renovate-tests/level2

        go 1.19

        require github.com/renovate-tests/gomod-with-replace v1.0.0
        require github.com/renovate-tests/gomod1 v1.0.0

        replace github.com/renovate-tests/gomod-with-replace => ../gomod-with-replace
        replace github.com/renovate-tests/gomod1 => ../gomod1
      `;

      const goModLevel3 = codeBlock`
        module github.com/renovate-tests/level3

        go 1.19

        require github.com/renovate-tests/level2 v1.0.0

        replace github.com/renovate-tests/level2 => ../level2
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'gomod-with-replace/go.mod',
        'level2/go.mod',
        'level3/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithReplace);
      fs.readLocalFile.mockResolvedValueOnce(goModLevel2);
      fs.readLocalFile.mockResolvedValueOnce(goModLevel3);

      // Ensure packages aren't processed multiple times in complex dependency chains
      expect(await getTransitiveDependentModules('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: false, name: 'gomod-with-replace/go.mod' },
        { isLeaf: false, name: 'level2/go.mod' },
        { isLeaf: true, name: 'level3/go.mod' },
      ]);
    });

    it('handles replace blocks with malformed entries', async () => {
      const goModMalformed = codeBlock`
        module github.com/renovate-tests/malformed

        go 1.19

        replace (
          github.com/renovate-tests/gomod1 => ../gomod1
          malformed line without arrow
          github.com/renovate-tests/gomod2 => ../gomod2
        )
      `;

      scm.getFileList.mockResolvedValue(['gomod1/go.mod', 'malformed/go.mod']);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModMalformed);

      expect(await getTransitiveDependentModules('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'malformed/go.mod' },
      ]);
    });

    it('handles replace blocks without closing parenthesis', async () => {
      const goModUnclosed = codeBlock`
        module github.com/renovate-tests/unclosed

        go 1.19

        replace (
          github.com/renovate-tests/gomod1 => ../gomod1
      `;

      scm.getFileList.mockResolvedValue(['gomod1/go.mod', 'unclosed/go.mod']);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModUnclosed);

      expect(await getTransitiveDependentModules('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'unclosed/go.mod' },
      ]);
    });

    it('handles quoted paths with spaces', async () => {
      const goModQuoted = codeBlock`
        module github.com/renovate-tests/quoted

        go 1.19

        replace github.com/renovate-tests/gomod1 => "../simple-path"
      `;

      scm.getFileList.mockResolvedValue([
        'simple-path/go.mod',
        'quoted/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModQuoted);

      expect(await getTransitiveDependentModules('simple-path/go.mod')).toEqual(
        [
          { isLeaf: false, name: 'simple-path/go.mod' },
          { isLeaf: true, name: 'quoted/go.mod' },
        ],
      );
    });

    it('handles current directory references', async () => {
      const goModCurrentDir = codeBlock`
        module github.com/renovate-tests/current

        go 1.19

        replace github.com/renovate-tests/gomod1 => ./gomod1
      `;

      scm.getFileList.mockResolvedValue([
        'current/gomod1/go.mod',
        'current/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModCurrentDir);

      expect(
        await getTransitiveDependentModules('current/gomod1/go.mod'),
      ).toEqual([
        { isLeaf: false, name: 'current/gomod1/go.mod' },
        { isLeaf: true, name: 'current/go.mod' },
      ]);
    });

    it('handles empty repository', async () => {
      scm.getFileList.mockResolvedValue([]);

      expect(await getTransitiveDependentModules('go.mod')).toEqual([]);
    });

    it('handles repository with no go.mod files', async () => {
      scm.getFileList.mockResolvedValue(['package.json', 'README.md']);

      expect(await getTransitiveDependentModules('go.mod')).toEqual([]);
    });

    it('filters files ending with go.mod correctly', async () => {
      scm.getFileList.mockResolvedValue([
        'backup-go.mod',
        'go.mod.backup',
        'go.mod',
        'test/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValue(sampleGoMod);

      expect(await getTransitiveDependentModules('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);
    });

    it('handles replace blocks with comments and empty lines', async () => {
      const goModWithComments = codeBlock`
        module github.com/renovate-tests/comments

        go 1.19

        replace (
          // This is a comment
          github.com/renovate-tests/gomod1 => ../gomod1

          // Another comment
          github.com/renovate-tests/gomod2 => ../gomod2 // inline comment

          // More comments
        )
      `;

      scm.getFileList.mockResolvedValue(['gomod1/go.mod', 'comments/go.mod']);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithComments);

      expect(await getTransitiveDependentModules('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'comments/go.mod' },
      ]);
    });

    it('handles case sensitivity in replace keyword', async () => {
      const goModCaseSensitive = codeBlock`
        module github.com/renovate-tests/case-test

        go 1.19

        Replace github.com/renovate-tests/gomod1 => ../gomod1
        REPLACE github.com/renovate-tests/gomod2 => ../gomod2
        replace github.com/renovate-tests/gomod3 => ../gomod3
      `;

      scm.getFileList.mockResolvedValue(['gomod3/go.mod', 'case-test/go.mod']);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModCaseSensitive);

      expect(await getTransitiveDependentModules('gomod3/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod3/go.mod' },
        { isLeaf: true, name: 'case-test/go.mod' },
      ]);
    });

    it('handles deeply nested module paths', async () => {
      const goModNested = codeBlock`
        module github.com/renovate-tests/deeply/nested

        go 1.19

        replace github.com/renovate-tests/shared => ../../../../shared
      `;

      scm.getFileList.mockResolvedValue(['shared/go.mod', 'a/b/c/d/go.mod']);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModNested);

      expect(await getTransitiveDependentModules('shared/go.mod')).toEqual([
        { isLeaf: false, name: 'shared/go.mod' },
        { isLeaf: true, name: 'a/b/c/d/go.mod' },
      ]);
    });

    it('handles complex relative paths with dots', async () => {
      const goModComplex = codeBlock`
        module github.com/renovate-tests/complex

        go 1.19

        replace github.com/renovate-tests/shared => ./../../up/../down/./shared
      `;

      scm.getFileList.mockResolvedValue([
        'services/down/shared/go.mod',
        'services/api/complex/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModComplex);

      expect(
        await getTransitiveDependentModules('services/down/shared/go.mod'),
      ).toEqual([
        { isLeaf: false, name: 'services/down/shared/go.mod' },
        { isLeaf: true, name: 'services/api/complex/go.mod' },
      ]);
    });

    it('handles quoted module names with special characters', async () => {
      const goModQuotedModule = codeBlock`
        module github.com/renovate-tests/quoted

        go 1.19

        replace "github.com/renovate-tests/special-chars" => "../special-chars"
      `;

      scm.getFileList.mockResolvedValue([
        'special-chars/go.mod',
        'quoted/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModQuotedModule);

      expect(
        await getTransitiveDependentModules('special-chars/go.mod'),
      ).toEqual([
        { isLeaf: false, name: 'special-chars/go.mod' },
        { isLeaf: true, name: 'quoted/go.mod' },
      ]);
    });

    it('handles incomplete quotes correctly', async () => {
      const goModIncompleteQuotes = codeBlock`
        module github.com/renovate-tests/incomplete

        go 1.19

        replace github.com/renovate-tests/half-quoted => "../half-quoted
        replace github.com/renovate-tests/no-quote => ../no-quote
      `;

      scm.getFileList.mockResolvedValue([
        'no-quote/go.mod',
        'incomplete/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModIncompleteQuotes);

      expect(await getTransitiveDependentModules('no-quote/go.mod')).toEqual([
        { isLeaf: false, name: 'no-quote/go.mod' },
        { isLeaf: true, name: 'incomplete/go.mod' },
      ]);
    });
  });
});

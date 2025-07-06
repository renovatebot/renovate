import { codeBlock } from 'common-tags';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { getDependentGoModFiles } from './package-tree';
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

const goModWithMultipleReplace = codeBlock`
  module github.com/renovate-tests/gomod-multiple

  go 1.19

  require github.com/pkg/errors v0.7.0
  require github.com/renovate-tests/gomod1 v1.0.0
  require github.com/renovate-tests/gomod2 v1.0.0

  replace github.com/renovate-tests/gomod1 => ../gomod1
  replace github.com/renovate-tests/gomod2 => ../gomod2
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

const goModTreeLike = codeBlock`
  module github.com/renovate-tests/tree-like

  go 1.19

  require github.com/renovate-tests/gomod1 v1.0.0

  replace github.com/renovate-tests/gomod1 => ../gomod1
`;

const goModTreeLikeTwo = codeBlock`
  module github.com/renovate-tests/tree-like-two

  go 1.19

  require github.com/renovate-tests/gomod1 v1.0.0

  replace github.com/renovate-tests/gomod1 => ../gomod1
`;

describe('modules/manager/gomod/package-tree', () => {
  describe('getDependentGoModFiles()', () => {
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

      expect(await getDependentGoModFiles('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);
    });

    it('returns self for two projects with no references', async () => {
      scm.getFileList.mockResolvedValue(['one/go.mod', 'two/go.mod']);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);

      expect(await getDependentGoModFiles('one/go.mod')).toEqual([
        { isLeaf: true, name: 'one/go.mod' },
      ]);
      expect(await getDependentGoModFiles('two/go.mod')).toEqual([
        { isLeaf: true, name: 'two/go.mod' },
      ]);
    });

    it('returns projects for two projects with one reference', async () => {
      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'gomod-with-replace/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithReplace);

      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'gomod-with-replace/go.mod' },
      ]);
    });

    it('returns projects for three projects with two linear references', async () => {
      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'gomod-with-replace/go.mod',
        'gomod-multiple/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithReplace);
      fs.readLocalFile.mockResolvedValueOnce(goModWithMultipleReplace);

      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'gomod-with-replace/go.mod' },
        { isLeaf: true, name: 'gomod-multiple/go.mod' },
      ]);
    });

    it('returns projects for three projects with two tree-like references', async () => {
      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'tree-like/go.mod',
        'tree-like-two/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModTreeLike);
      fs.readLocalFile.mockResolvedValueOnce(goModTreeLikeTwo);

      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'tree-like/go.mod' },
        { isLeaf: true, name: 'tree-like-two/go.mod' },
      ]);

      expect(await getDependentGoModFiles('tree-like/go.mod')).toEqual([
        { isLeaf: true, name: 'tree-like/go.mod' },
      ]);
      expect(await getDependentGoModFiles('tree-like-two/go.mod')).toEqual([
        { isLeaf: true, name: 'tree-like-two/go.mod' },
      ]);
    });

    it('returns empty array on circular reference', async () => {
      scm.getFileList.mockResolvedValue([
        'circular-a/go.mod',
        'circular-b/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(goModWithCircularA);
      fs.readLocalFile.mockResolvedValueOnce(goModWithCircularB);

      expect(await getDependentGoModFiles('circular-a/go.mod')).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        'Circular reference detected in Go modules replace directives',
      );
    });

    it('returns self when file content is null', async () => {
      scm.getFileList.mockResolvedValue(['go.mod']);
      fs.readLocalFile.mockResolvedValueOnce(null);

      expect(await getDependentGoModFiles('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);
    });

    it('returns self when file content is empty', async () => {
      scm.getFileList.mockResolvedValue(['go.mod']);
      fs.readLocalFile.mockResolvedValueOnce('');

      expect(await getDependentGoModFiles('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);
    });

    it('handles invalid go.mod syntax gracefully', async () => {
      scm.getFileList.mockResolvedValue(['go.mod']);
      fs.readLocalFile.mockResolvedValueOnce('invalid go.mod content');

      expect(await getDependentGoModFiles('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);
    });

    it('handles missing target go.mod files', async () => {
      scm.getFileList.mockResolvedValue(['gomod-with-replace/go.mod']);
      fs.readLocalFile.mockResolvedValueOnce(goModWithReplace);

      expect(await getDependentGoModFiles('nonexistent/go.mod')).toEqual([
        { isLeaf: true, name: 'nonexistent/go.mod' },
      ]);
    });

    it('handles replace directives with version specifiers', async () => {
      const goModWithVersionReplace = codeBlock`
        module github.com/renovate-tests/version-replace

        go 1.19

        require github.com/renovate-tests/gomod1 v1.0.0

        replace github.com/renovate-tests/gomod1 => ../gomod1 v1.2.3
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'version-replace/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithVersionReplace);

      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'version-replace/go.mod' },
      ]);
    });

    it('handles replace directives with comments', async () => {
      const goModWithCommentReplace = codeBlock`
        module github.com/renovate-tests/comment-replace

        go 1.19

        require github.com/renovate-tests/gomod1 v1.0.0

        replace github.com/renovate-tests/gomod1 => ../gomod1 // local development
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'comment-replace/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithCommentReplace);

      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'comment-replace/go.mod' },
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

      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
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

      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
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

      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: false, name: 'gomod-with-replace/go.mod' },
        { isLeaf: true, name: 'level2/go.mod' },
      ]);

      expect(await getDependentGoModFiles('gomod-with-replace/go.mod')).toEqual(
        [
          { isLeaf: false, name: 'gomod-with-replace/go.mod' },
          { isLeaf: true, name: 'level2/go.mod' },
        ],
      );

      expect(await getDependentGoModFiles('level2/go.mod')).toEqual([
        { isLeaf: true, name: 'level2/go.mod' },
      ]);
    });
  });
});

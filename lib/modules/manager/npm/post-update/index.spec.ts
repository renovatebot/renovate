// TODO: add tests
import { fs, git } from '../../../../../test/util';
import { updateYarnBinary } from './index';

jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');

describe('modules/manager/npm/post-update/index', () => {
  const lockFileDir = `path/to/lockfile`;
  const oldYarnrcYml = `yarnPath: .yarn/releases/yarn-3.0.1.cjs\na: b\n`;
  const newYarnrcYml = `yarnPath: .yarn/releases/yarn-3.0.2.cjs\nc: d\n`;
  const newYarn = `new yarn\n`;

  beforeEach(() => {
    git.getFile = jest.fn();
    fs.readLocalFile = jest.fn();
  });

  describe('updateYarnBinary()', () => {
    it('should update the Yarn binary', async () => {
      git.getFile.mockResolvedValueOnce(oldYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarn);
      const updatedArtifacts = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toMatchSnapshot();
    });

    it('should return .yarnrc.yml content if it has been overwritten', async () => {
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarn);
      let existingYarnrcYmlContent = oldYarnrcYml;
      const updatedArtifacts = [];
      existingYarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        existingYarnrcYmlContent
      );
      expect(git.getFile).not.toHaveBeenCalled();
      expect(existingYarnrcYmlContent).toMatchSnapshot();
      expect(updatedArtifacts).toMatchSnapshot();
    });

    it("should not update the Yarn binary if the old .yarnrc.yml doesn't exist", async () => {
      git.getFile.mockResolvedValueOnce(null);
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      const updatedArtifacts = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toBeEmpty();
    });

    it("should not update the Yarn binary if the new .yarnrc.yml doesn't exist", async () => {
      git.getFile.mockResolvedValueOnce(oldYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(null);
      const updatedArtifacts = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toBeEmpty();
    });

    it("should return existing .yarnrc.yml if the new one doesn't exist", async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      let existingYarnrcYmlContent = oldYarnrcYml;
      const updatedArtifacts = [];
      existingYarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        existingYarnrcYmlContent
      );
      expect(existingYarnrcYmlContent).toMatch(existingYarnrcYmlContent);
      expect(updatedArtifacts).toBeEmpty();
    });
  });
});

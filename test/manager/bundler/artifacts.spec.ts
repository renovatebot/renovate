import _fs from 'fs-extra';
import Git from 'simple-git/promise';
import { updateArtifacts } from '../../../lib/manager/bundler';
import * as _exec from '../../../lib/util/exec';
import { platform as _platform } from '../../../lib/platform';
import * as _datasource from '../../../lib/datasource/docker';
import { mocked } from '../../util';

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec = mocked(_exec).exec;
const platform = mocked(_platform);
const datasource = mocked(_datasource);

jest.mock('fs-extra');
jest.mock('../../../lib/util/exec');
jest.mock('../../../lib/platform');
jest.mock('../../../lib/datasource/docker');

let config;

describe('bundler.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    config = {
      localDir: '/tmp/github/some/repo',
    };
  });
  it('returns null by default', async () => {
    expect(await updateArtifacts('', [], '', config)).toBeNull();
  });
  it('returns null if Gemfile.lock was not changed', async () => {
    platform.getFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.outputFile.mockResolvedValueOnce(null as never);
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: [],
    } as Git.StatusResult);
    fs.readFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
    expect(
      await updateArtifacts('Gemfile', [], 'Updated Gemfile content', config)
    ).toMatchSnapshot();
  });
  it('works for default binarySource', async () => {
    platform.getFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.outputFile.mockResolvedValueOnce(null as never);
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['Gemfile.lock'],
    } as Git.StatusResult);
    fs.readFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
    expect(
      await updateArtifacts('Gemfile', [], 'Updated Gemfile content', config)
    ).toMatchSnapshot();
  });
  it('works explicit global binarySource', async () => {
    platform.getFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.outputFile.mockResolvedValueOnce(null as never);
    exec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
    });
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['Gemfile.lock'],
    } as Git.StatusResult);
    fs.readFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
    expect(
      await updateArtifacts('Gemfile', [], 'Updated Gemfile content', {
        ...config,
        binarySource: 'global',
      })
    ).toMatchSnapshot();
  });
  describe('Docker', () => {
    it('.ruby-version', async () => {
      let dockerCommand = null;
      platform.getFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.outputFile.mockResolvedValueOnce(null as never);
      platform.getFile.mockResolvedValueOnce('1.2.0');
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.2.0' },
          { version: '1.3.0' },
        ],
      });
      exec.mockImplementationOnce(cmd => {
        dockerCommand = cmd;
        return Promise.resolve({
          stdout: '',
          stderr: '',
        });
      });
      platform.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as Git.StatusResult);
      fs.readFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
      expect(
        await updateArtifacts('Gemfile', [], 'Updated Gemfile content', {
          ...config,
          binarySource: 'docker',
        })
      ).toMatchSnapshot();
      expect(dockerCommand.replace(/\\(\w)/, '/$1')).toMatchSnapshot();
    });
    it('compatibility options', async () => {
      let dockerCommand = null;
      platform.getFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.outputFile.mockResolvedValueOnce(null as never);
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.2.0' },
          { version: '1.3.0' },
        ],
      });
      exec.mockImplementationOnce(cmd => {
        dockerCommand = cmd;
        return Promise.resolve({
          stdout: '',
          stderr: '',
        });
      });
      platform.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as Git.StatusResult);
      fs.readFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
      expect(
        await updateArtifacts('Gemfile', [], 'Updated Gemfile content', {
          ...config,
          binarySource: 'docker',
          dockerUser: 'foobar',
          compatibility: {
            ruby: '1.2.5',
            bundler: '3.2.1',
          },
        })
      ).toMatchSnapshot();
      expect(dockerCommand.replace(/\\(\w)/, '/$1')).toMatchSnapshot();
    });
  });
});

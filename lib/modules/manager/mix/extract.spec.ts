import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import { extractPackageFile } from '.';
import { codeBlock } from 'common-tags';
import { fs } from '../../../../test/util';
import { valid } from 'semver';

jest.mock('../../../util/fs');

const mixExs = Fixtures.get("mix.exs")
const mixLock = Fixtures.get("mix.lock")

describe('modules/manager/mix/extract', () => {
  // beforeEach(() => {
  //   GlobalConfig.set({ localDir: '' });
  // });

  describe('extractPackageFile()', () => {
    it('returns empty for invalid dependency file', async () => {
      const res = await extractPackageFile('nothing here', 'mix.exs');
      expect(res).toBeNull();
    });

    it('extracts all dependencies when no lockfile', async () => {
      const res = await extractPackageFile(mixExs, 'mix.exs');
      expect(res?.deps).toEqual([
        {
          currentValue: '~> 0.8.1',
          datasource: 'hex',
          depName: 'postgrex',
          packageName: 'postgrex',
        },
        {
          currentValue: '>2.1.0 or <=3.0.0',
          datasource: 'hex',
          depName: 'foo_bar',
          packageName: 'foo_bar',
        },
        {
          currentDigest: undefined,
          currentValue: 'v0.4.1',
          datasource: 'github-tags',
          depName: 'cowboy',
          packageName: 'ninenines/cowboy',
        },
        {
          currentDigest: undefined,
          currentValue: 'main',
          datasource: 'git-tags',
          depName: 'phoenix',
          packageName: 'https://github.com/phoenixframework/phoenix.git',
        },
        {
          currentDigest: '795036d997c7503b21fb64d6bf1a89b83c44f2b5',
          currentValue: undefined,
          datasource: 'github-tags',
          depName: 'ecto',
          packageName: 'elixir-ecto/ecto',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'secret',
          packageName: 'secret:acme',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          packageName: 'also_secret:acme',
        },
        {
          currentValue: '>2.1.0 and <=3.0.0',
          datasource: 'hex',
          depName: 'ex_doc',
          packageName: 'ex_doc',
        },
        {
          currentValue: '>= 1.0.0',
          datasource: 'hex',
          depName: 'jason',
          packageName: 'jason',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'mason',
          packageName: 'mason',
        },
        {
          currentValue: '~> 6.1',
          datasource: 'hex',
          depName: 'hammer_backend_redis',
          packageName: 'hammer_backend_redis',
        },
        {
          currentValue: '== 1.6.14',
          currentVersion: '1.6.14',
          datasource: 'hex',
          depName: 'public',
          packageName: 'public',
        },
      ]);
    });

    it('extracts all dependencies and adds the locked version if lockfile present', async () => {
      // allows fetching the sibling mix.lock file
      fs.readLocalFile.mockResolvedValue(mixLock);
      const res = await extractPackageFile(mixExs, 'mix.exs');
      expect(res?.deps).toEqual([
        {
          currentValue: '~> 0.8.1',
          datasource: 'hex',
          depName: 'postgrex',
          packageName: 'postgrex',
          lockedVersion: '0.8.2',
        },
        {
          currentValue: '>2.1.0 or <=3.0.0',
          datasource: 'hex',
          depName: 'foo_bar',
          packageName: 'foo_bar',
          lockedVersion: '2.2.0',
        },
        {
          currentDigest: undefined,
          currentValue: 'v0.4.1',
          datasource: 'github-tags',
          depName: 'cowboy',
          packageName: 'ninenines/cowboy',
          lockedVersion: undefined,
        },
        {
          currentDigest: undefined,
          currentValue: 'main',
          datasource: 'git-tags',
          depName: 'phoenix',
          packageName: 'https://github.com/phoenixframework/phoenix.git',
          lockedVersion: undefined,
        },
        {
          currentDigest: '795036d997c7503b21fb64d6bf1a89b83c44f2b5',
          currentValue: undefined,
          datasource: 'github-tags',
          depName: 'ecto',
          packageName: 'elixir-ecto/ecto',
          lockedVersion: undefined,
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'secret',
          packageName: 'secret:acme',
          lockedVersion: '1.5.0',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          packageName: 'also_secret:acme',
          lockedVersion: '1.3.4',
        },
        {
          currentValue: '>2.1.0 and <=3.0.0',
          datasource: 'hex',
          depName: 'ex_doc',
          packageName: 'ex_doc',
          lockedVersion: '2.2.0',
        },
        {
          currentValue: '>= 1.0.0',
          datasource: 'hex',
          depName: 'jason',
          packageName: 'jason',
          lockedVersion: '1.0.1',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'mason',
          packageName: 'mason',
          lockedVersion: '1.1.0',
        },
        {
          currentValue: '~> 6.1',
          datasource: 'hex',
          depName: 'hammer_backend_redis',
          packageName: 'hammer_backend_redis',
          lockedVersion: '6.1.5',
        },
        {
          currentValue: '== 1.6.14',
          currentVersion: '1.6.14',
          datasource: 'hex',
          depName: 'public',
          packageName: 'public',
          lockedVersion: '1.6.14',
        },
      ]);
    });
    it('skips git dependencies that are not semver for mix.exs',async()=>{

      const lock = codeBlock`
     %{
        "basic_dep": {:git, "https://github.com/user/repo.git", "d2a084a3d2f2ab27b76192c71ccf0cfbd9276a5c", []},
        "branch_dep": {:git, "https://github.com/user/repo.git", "3a9c2168ee9f35642aa378d3dc2a8b8e5265e6c2", [branch: "main"]},
        "commit_dep": {:git, "https://github.com/user/repo.git", "abc1239d7a49d7b7aea5a31a70431f2db4e67ac0", [ref: "abc123"]},
        "make_dep": {:git, "https://github.com/user/repo.git", "abc1239d7a49d7b7aea5a31a70431f2db4e67ac0", [ref: "abc123"]},
        "non_semver_tag": {:git, "https://github.com/user/repo.git", "7e1ff6c2e62c7708db564f25b4b13944f6df8d4d", [tag: "non-semver-tag]},
        
      }
      `

      fs.readLocalFile.mockResolvedValue(lock);
      const content = codeBlock`
      defp deps() do
        [
          {:basic_dep, git: "https://github.com/user/repo.git"},
          {:branch_dep, git: "https://github.com/user/repo.git", branch: "main-not-semver"},
          {:commit_dep, git: "https://github.com/user/repo.git", ref: "abc123notsemver"},
          {:make_dep, git: "https://github.com/user/repo.git", ref: "abc123", manager: :make},
          {:non_semver_tag, git: "https://github.com/user/repo.git", tag: "not-semver-tag"},
          {:semver_tag, git: "https://github.com/user/repo.git", tag: "v0.1.0"},
        ]
      end
      `
      const res = (await extractPackageFile(content, 'mix.exs'))!.deps
      const skipFor = ['basic_dep','branch_dep','commit_dep','make_dep','non_semver_tag']
      const skipped = res.filter(x=>x.skipReason)
      expect(skipped).toHaveLength(5)
      expect(res.every(x=>skipFor.includes(x.depName!)))
      expect(skipped.every(x=>x.skipReason==='unsupported'))
      expect(res).toHaveLength(6)
    } );
    it('skips git dependencies that are not semver for mix.lock',async()=>{
      const content = codeBlock`
     %{
        "basic_dep": {:git, "https://github.com/user/repo.git", "d2a084a3d2f2ab27b76192c71ccf0cfbd9276a5c", []},
        "branch_dep": {:git, "https://github.com/user/repo.git", "3a9c2168ee9f35642aa378d3dc2a8b8e5265e6c2", [branch: "main"]},
        "commit_dep": {:git, "https://github.com/user/repo.git", "abc1239d7a49d7b7aea5a31a70431f2db4e67ac0", [ref: "abc123"]},
        "make_dep": {:git, "https://github.com/user/repo.git", "abc1239d7a49d7b7aea5a31a70431f2db4e67ac0", [ref: "abc123"]},
        "non_semver_tag": {:git, "https://github.com/user/repo.git", "7e1ff6c2e62c7708db564f25b4b13944f6df8d4d", [tag: "non-semver-tag]},
        "semver_tag": {:git, "https://github.com/user/repo.git", "7e1ff6c2e62c7708db564f25b4b13944f6df8d4d", [tag: "v1.0.0"]},
      }
      `
      const res = (await extractPackageFile(content, 'mix.lock'))!.deps
      const skipFor = ['basic_dep','branch_dep','commit_dep','make_dep','non_semver_tag']
      const skipped = res.filter(x=>x.skipReason)
      expect(skipped).toHaveLength(5)
      expect(res.every(x=>skipFor.includes(x.depName!)))
      expect(skipped.every(x=>x.skipReason==='unsupported'))
      expect(res).toHaveLength(6)
    } );
    it('things', async ()=>{
      const x = !!valid("v1.2.3");
      console.log(x)
      return x
    });
  });
  
});

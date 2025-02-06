import { GithubContentResponse } from './schema';

describe('modules/platform/github/schema', () => {
  it('should be parse directory response', () => {
    const { error } = GithubContentResponse.safeParse([
      {
        type: 'file',
        size: 625,
        name: 'octokit.rb',
        path: 'lib/octokit.rb',
        sha: 'fff6fe3a23bf1c8ea0692b4a883af99bee26fd3b',
        url: 'https://api.github.com/repos/octokit/octokit.rb/contents/lib/octokit.rb',
        git_url:
          'https://api.github.com/repos/octokit/octokit.rb/git/blobs/fff6fe3a23bf1c8ea0692b4a883af99bee26fd3b',
        html_url:
          'https://github.com/octokit/octokit.rb/blob/master/lib/octokit.rb',
        download_url:
          'https://raw.githubusercontent.com/octokit/octokit.rb/master/lib/octokit.rb',
        _links: {
          self: 'https://api.github.com/repos/octokit/octokit.rb/contents/lib/octokit.rb',
          git: 'https://api.github.com/repos/octokit/octokit.rb/git/blobs/fff6fe3a23bf1c8ea0692b4a883af99bee26fd3b',
          html: 'https://github.com/octokit/octokit.rb/blob/master/lib/octokit.rb',
        },
      },
      {
        type: 'dir',
        size: 0,
        name: 'octokit',
        path: 'lib/octokit',
        sha: 'a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d',
        url: 'https://api.github.com/repos/octokit/octokit.rb/contents/lib/octokit',
        git_url:
          'https://api.github.com/repos/octokit/octokit.rb/git/trees/a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d',
        html_url:
          'https://github.com/octokit/octokit.rb/tree/master/lib/octokit',
        download_url: null,
        _links: {
          self: 'https://api.github.com/repos/octokit/octokit.rb/contents/lib/octokit',
          git: 'https://api.github.com/repos/octokit/octokit.rb/git/trees/a84d88e7554fc1fa21bcbc4efae3c782a70d2b9d',
          html: 'https://github.com/octokit/octokit.rb/tree/master/lib/octokit',
        },
      },
      {
        type: 'symlink',
        target: '/path/to/symlink/target',
        size: 23,
        name: 'some-symlink',
        path: 'bin/some-symlink',
        sha: '452a98979c88e093d682cab404a3ec82babebb48',
        url: 'https://api.github.com/repos/octokit/octokit.rb/contents/bin/some-symlink',
        git_url:
          'https://api.github.com/repos/octokit/octokit.rb/git/blobs/452a98979c88e093d682cab404a3ec82babebb48',
        html_url:
          'https://github.com/octokit/octokit.rb/blob/master/bin/some-symlink',
        download_url:
          'https://raw.githubusercontent.com/octokit/octokit.rb/master/bin/some-symlink',
        _links: {
          git: 'https://api.github.com/repos/octokit/octokit.rb/git/blobs/452a98979c88e093d682cab404a3ec82babebb48',
          self: 'https://api.github.com/repos/octokit/octokit.rb/contents/bin/some-symlink',
          html: 'https://github.com/octokit/octokit.rb/blob/master/bin/some-symlink',
        },
      },
      {
        type: 'submodule',
        submodule_git_url: 'git://github.com/jquery/qunit.git',
        size: 0,
        name: 'qunit',
        path: 'test/qunit',
        sha: '6ca3721222109997540bd6d9ccd396902e0ad2f9',
        url: 'https://api.github.com/repos/jquery/jquery/contents/test/qunit?ref=master',
        git_url:
          'https://api.github.com/repos/jquery/qunit/git/trees/6ca3721222109997540bd6d9ccd396902e0ad2f9',
        html_url:
          'https://github.com/jquery/qunit/tree/6ca3721222109997540bd6d9ccd396902e0ad2f9',
        download_url: null,
        _links: {
          git: 'https://api.github.com/repos/jquery/qunit/git/trees/6ca3721222109997540bd6d9ccd396902e0ad2f9',
          self: 'https://api.github.com/repos/jquery/jquery/contents/test/qunit?ref=master',
          html: 'https://github.com/jquery/qunit/tree/6ca3721222109997540bd6d9ccd396902e0ad2f9',
        },
      },
    ]);
    expect(error).toBeUndefined();
  });

  it('should parse response for single file', () => {
    const { error } = GithubContentResponse.safeParse({
      type: 'file',
      encoding: 'base64',
      size: 5362,
      name: 'README.md',
      path: 'README.md',
      content: 'aaaaaaaaaa',
      sha: '3d21ec53a331a6f037a91c368710b99387d012c1',
      url: 'https://api.github.com/repos/octokit/octokit.rb/contents/README.md',
      git_url:
        'https://api.github.com/repos/octokit/octokit.rb/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1',
      html_url: 'https://github.com/octokit/octokit.rb/blob/master/README.md',
      download_url:
        'https://raw.githubusercontent.com/octokit/octokit.rb/master/README.md',
      _links: {
        git: 'https://api.github.com/repos/octokit/octokit.rb/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1',
        self: 'https://api.github.com/repos/octokit/octokit.rb/contents/README.md',
        html: 'https://github.com/octokit/octokit.rb/blob/master/README.md',
      },
    });
    expect(error).toBeUndefined();
  });
});

import * as httpMock from '../../../test/http-mock';
import { loadFixture, mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import { id as githubDatasource } from '../github-tags';
import { GitlabTagsDatasource } from '../gitlab-tags';
import { BaseGoDatasource } from './base';

jest.mock('../../util/host-rules');

const hostRules = mocked(_hostRules);

describe('datasource/go/base', () => {
  describe('simple cases', () => {
    test.each`
      module                     | datasource          | lookupName
      ${'gopkg.in/foo'}          | ${'github-tags'}    | ${'go-foo/foo'}
      ${'gopkg.in/foo/bar'}      | ${'github-tags'}    | ${'foo/bar'}
      ${'github.com/foo/bar'}    | ${'github-tags'}    | ${'foo/bar'}
      ${'bitbucket.org/foo/bar'} | ${'bitbucket-tags'} | ${'foo/bar'}
    `(
      '$module -> $datasource: $lookupName',
      async ({ module, datasource, lookupName }) => {
        const res = await BaseGoDatasource.getDatasource(module);
        expect(res).toMatchObject({ datasource, lookupName });
      }
    );
  });

  describe('go-get requests', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.find.mockReturnValue({});
      hostRules.hosts.mockReturnValue([]);
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    describe('meta name=go-source', () => {
      it('returns null for unknown prefix', async () => {
        const meta =
          '<meta name="go-source" content="golang.org/x/text https://github.com/golang/text/ foobar">';
        httpMock
          .scope('https://example.com')
          .get('/x/text?go-get=1')
          .reply(200, meta);

        const res = await BaseGoDatasource.getDatasource('example.com/x/text');

        expect(res).toBeNull();
      });

      it('returns null for unknown datasource', async () => {
        httpMock
          .scope('https://example.com')
          .get('/example/module?go-get=1')
          .reply(200);

        const res = await BaseGoDatasource.getDatasource(
          'example.com/example/module'
        );

        expect(res).toBeNull();
      });

      it('returns null for go-import prefix mismatch', async () => {
        const mismatchResponse = loadFixture('go-get-github-ee.html').replace(
          'git.enterprise.com/example/module',
          'git.enterprise.com/badexample/badmodule'
        );
        httpMock
          .scope('https://example.com')
          .get('/example/module?go-get=1')
          .reply(200, mismatchResponse);

        const res = await BaseGoDatasource.getDatasource(
          'example.com/example/module'
        );

        expect(res).toBeNull();
      });

      it('supports GitHub deps', async () => {
        httpMock
          .scope('https://golang.org')
          .get('/x/text?go-get=1')
          .reply(200, loadFixture('go-get-github.html'));

        const res = await BaseGoDatasource.getDatasource('golang.org/x/text');

        expect(res).toEqual({
          datasource: githubDatasource,
          lookupName: 'golang/text',
          registryUrl: 'https://github.com',
        });
      });

      it('supports GitHub EE deps', async () => {
        httpMock
          .scope('https://git.enterprise.com')
          .get('/example/module?go-get=1')
          .reply(200, loadFixture('go-get-github-ee.html'));

        const res = await BaseGoDatasource.getDatasource(
          'git.enterprise.com/example/module'
        );

        expect(res).toEqual({
          datasource: githubDatasource,
          lookupName: 'example/module',
          registryUrl: 'https://git.enterprise.com',
        });
      });

      it('supports GitLab deps', async () => {
        httpMock
          .scope('https://gitlab.com')
          .get('/group/subgroup?go-get=1')
          .reply(200, loadFixture('go-get-gitlab.html'));

        const res = await BaseGoDatasource.getDatasource(
          'gitlab.com/group/subgroup'
        );

        expect(res).toEqual({
          datasource: GitlabTagsDatasource.id,
          lookupName: 'group/subgroup',
          registryUrl: 'https://gitlab.com',
        });
      });

      it('supports GitLab deps on private subgroups', async () => {
        httpMock
          .scope('https://gitlab.com')
          .get('/group/subgroup/private.git/v3?go-get=1')
          .reply(200, loadFixture('go-get-gitlab.html'));

        const res = await BaseGoDatasource.getDatasource(
          'gitlab.com/group/subgroup/private.git/v3'
        );

        expect(res).toEqual({
          datasource: GitlabTagsDatasource.id,
          lookupName: 'group/subgroup/private',
          registryUrl: 'https://gitlab.com',
        });
      });

      it('supports GitLab with URL mismatch', async () => {
        const mismatchingResponse = loadFixture('go-get-github.html').replace(
          'https://github.com/golang/text/',
          'https://gitlab.com/golang/text/'
        );
        httpMock
          .scope('https://golang.org')
          .get('/x/text?go-get=1')
          .reply(200, mismatchingResponse);

        const res = await BaseGoDatasource.getDatasource('golang.org/x/text');

        expect(res).toEqual({
          datasource: GitlabTagsDatasource.id,
          lookupName: 'golang/text',
          registryUrl: 'https://gitlab.com',
        });
      });

      it('supports GitLab deps with version', async () => {
        httpMock
          .scope('https://gitlab.com')
          .get('/group/subgroup/v2?go-get=1')
          .reply(200, loadFixture('go-get-gitlab.html'));

        const res = await BaseGoDatasource.getDatasource(
          'gitlab.com/group/subgroup/v2'
        );

        expect(res).toEqual({
          datasource: gitlabDatasource,
          lookupName: 'group/subgroup',
          registryUrl: 'https://gitlab.com',
        });
      });

      it('supports GitLab EE deps', async () => {
        hostRules.find.mockReturnValue({ token: 'some-token' });
        httpMock
          .scope('https://my.custom.domain')
          .get('/golang/myrepo?go-get=1')
          .reply(200, loadFixture('go-get-gitlab-ee.html'));

        const res = await BaseGoDatasource.getDatasource(
          'my.custom.domain/golang/myrepo'
        );

        expect(res).toEqual({
          datasource: GitlabTagsDatasource.id,
          lookupName: 'golang/myrepo',
          registryUrl: 'https://my.custom.domain',
        });
      });

      it('handles fyne.io', async () => {
        const meta =
          '<meta name="go-import" content="fyne.io/fyne git https://github.com/fyne-io/fyne">';
        httpMock
          .scope('https://fyne.io')
          .get('/fyne?go-get=1')
          .reply(200, meta);

        const res = await BaseGoDatasource.getDatasource('fyne.io/fyne');

        expect(res).toEqual({
          datasource: 'github-tags',
          registryUrl: 'https://github.com',
          lookupName: 'fyne-io/fyne',
        });
      });
    });
  });
});

import { Milestone } from './schema';

describe('modules/platform/github/schema', () => {
  describe('Milestone', () => {
    it('parses demo data', () => {
      expect(
        Milestone.parse({
          url: 'https://api.github.com/repos/octocat/Hello-World/milestones/1',
          html_url: 'https://github.com/octocat/Hello-World/milestones/v1.0',
          labels_url:
            'https://api.github.com/repos/octocat/Hello-World/milestones/1/labels',
          id: 1002604,
          node_id: 'MDk6TWlsZXN0b25lMTAwMjYwNA==',
          number: 1,
          state: 'open',
          title: 'v1.0',
          description: 'Tracking milestone for version 1.0',
          creator: {
            login: 'octocat',
            id: 1,
            node_id: 'MDQ6VXNlcjE=',
            avatar_url: 'https://github.com/images/error/octocat_happy.gif',
            gravatar_id: '',
            url: 'https://api.github.com/users/octocat',
            html_url: 'https://github.com/octocat',
            followers_url: 'https://api.github.com/users/octocat/followers',
            following_url:
              'https://api.github.com/users/octocat/following{/other_user}',
            gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
            starred_url:
              'https://api.github.com/users/octocat/starred{/owner}{/repo}',
            subscriptions_url:
              'https://api.github.com/users/octocat/subscriptions',
            organizations_url: 'https://api.github.com/users/octocat/orgs',
            repos_url: 'https://api.github.com/users/octocat/repos',
            events_url: 'https://api.github.com/users/octocat/events{/privacy}',
            received_events_url:
              'https://api.github.com/users/octocat/received_events',
            type: 'User',
            site_admin: false,
          },
          open_issues: 4,
          closed_issues: 8,
          created_at: '2011-04-10T20:09:31Z',
          updated_at: '2014-03-03T18:58:10Z',
          closed_at: '2013-02-12T13:22:01Z',
          due_on: '2012-10-09T23:39:01Z',
        }),
      ).toEqual({
        id: 1002604,
        number: 1,
        title: 'v1.0',
        description: 'Tracking milestone for version 1.0',
        state: 'open',
      });
    });
  });
});

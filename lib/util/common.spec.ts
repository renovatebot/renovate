import { logger } from '../../test/util';
import { detectPlatform, parseJsonWithFallback } from './common';
import * as hostRules from './host-rules';

const validJsonString = `
{
  "name": "John Doe",
  "age": 30,
  "city": "New York"
}
`;
const invalidJsonString = `
{
  "name": "Alice",
  "age": 25,
  "city": "Los Angeles",
  "hobbies": ["Reading", "Running", "Cooking"]
  "isStudent": true
}
`;
const onlyJson5parsableString = `
{
  name: "Bob",
  age: 35,
  city: 'San Francisco',
  // This is a comment
  "isMarried": false,
}
`;

describe('util/common', () => {
  beforeEach(() => hostRules.clear());

  describe('detectPlatform', () => {
    it.each`
      url                                                                    | hostType
      ${'some-invalid@url:::'}                                               | ${null}
      ${'https://enterprise.example.com/chalk/chalk'}                        | ${null}
      ${'https://dev.azure.com/my-organization/my-project/_git/my-repo.git'} | ${'azure'}
      ${'https://myorg.visualstudio.com/my-project/_git/my-repo.git'}        | ${'azure'}
      ${'https://bitbucket.org/some-org/some-repo'}                          | ${'bitbucket'}
      ${'https://bitbucket.com/some-org/some-repo'}                          | ${'bitbucket'}
      ${'https://gitea.com/semantic-release/gitlab'}                         | ${'gitea'}
      ${'https://forgejo.example.com/semantic-release/gitlab'}               | ${'gitea'}
      ${'https://github.com/semantic-release/gitlab'}                        | ${'github'}
      ${'https://github-enterprise.example.com/chalk/chalk'}                 | ${'github'}
      ${'https://gitlab.com/chalk/chalk'}                                    | ${'gitlab'}
      ${'https://gitlab-enterprise.example.com/chalk/chalk'}                 | ${'gitlab'}
    `('("$url") === $hostType', ({ url, hostType }) => {
      expect(detectPlatform(url)).toBe(hostType);
    });

    it('uses host rules', () => {
      hostRules.add({
        hostType: 'bitbucket',
        matchHost: 'bb.example.com',
      });
      hostRules.add({
        hostType: 'gitea',
        matchHost: 'gt.example.com',
      });
      hostRules.add({
        hostType: 'github-changelog',
        matchHost: 'gh.example.com',
      });
      hostRules.add({
        hostType: 'gitlab-changelog',
        matchHost: 'gl.example.com',
      });
      hostRules.add({
        hostType: 'unknown',
        matchHost: 'f.example.com',
      });

      expect(detectPlatform('https://bb.example.com/chalk/chalk')).toBe(
        'bitbucket'
      );
      expect(detectPlatform('https://gt.example.com/chalk/chalk')).toBe(
        'gitea'
      );
      expect(detectPlatform('https://gh.example.com/chalk/chalk')).toBe(
        'github'
      );
      expect(detectPlatform('https://gl.example.com/chalk/chalk')).toBe(
        'gitlab'
      );
      expect(detectPlatform('https://f.example.com/chalk/chalk')).toBeNull();
    });
  });

  describe('parseJsonWithFallback', () => {
    it('returns parsed json', () => {
      expect(parseJsonWithFallback(validJsonString)).toEqual({
        name: 'John Doe',
        age: 30,
        city: 'New York',
      });
    });

    it('throws error for invalid json', () => {
      expect(() => parseJsonWithFallback(invalidJsonString)).toThrow();
    });

    it('catches and warns if content parsing faield with JSON.parse but not with JSON5.parse', () => {
      expect(parseJsonWithFallback(onlyJson5parsableString)).toEqual({
        name: 'Bob',
        age: 35,
        city: 'San Francisco',
        isMarried: false,
      });
      expect(logger.logger.warn).toHaveBeenCalledWith(
        'JSON5.parse was used to parse the JSON data. Please check your json file'
      );
    });
  });
});

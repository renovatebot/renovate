import { codeBlock } from 'common-tags';
import { detectPlatform, parseJson } from './common';
import * as hostRules from './host-rules';
import { logger } from '~test/util';

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
const validJsoncString = `
{
  // This is a comment
  "name": "John Doe",
  "age": 30,
  "city": "New York"
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
      ${'https://bitbucket.example.com/some-org/some-repo'}                  | ${'bitbucket-server'}
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
        'bitbucket',
      );
      expect(detectPlatform('https://gt.example.com/chalk/chalk')).toBe(
        'gitea',
      );
      expect(detectPlatform('https://gh.example.com/chalk/chalk')).toBe(
        'github',
      );
      expect(detectPlatform('https://gl.example.com/chalk/chalk')).toBe(
        'gitlab',
      );
      expect(detectPlatform('https://f.example.com/chalk/chalk')).toBeNull();
    });
  });

  describe('parseJson', () => {
    it('returns null', () => {
      expect(parseJson(null, 'renovate.json')).toBeNull();
    });

    it('returns parsed json', () => {
      expect(parseJson(validJsonString, 'renovate.json')).toEqual({
        name: 'John Doe',
        age: 30,
        city: 'New York',
      });
    });

    it('supports jsonc', () => {
      const jsoncString = codeBlock`
      {
        // This is a comment (valid in JSONC, invalid in JSON5 when outside object properties)
        "name": "Alice", // inline comment is valid in JSONC but not in JSON5
        "age": 25,       // JSON5 supports trailing commas, so this line is okay in both
        "city": "Atlanta",
        // JSONC allows comments here too
      }
      `;

      expect(parseJson(jsoncString, 'renovate.json')).toEqual({
        name: 'Alice',
        age: 25,
        city: 'Atlanta',
      });
    });

    it('throws error for invalid json', () => {
      expect(() => parseJson(invalidJsonString, 'renovate.json')).toThrow();
    });

    it('catches and warns if content parsing failed with JSONC.parse but not with JSON5.parse', () => {
      expect(parseJson(onlyJson5parsableString, 'renovate.json')).toEqual({
        name: 'Bob',
        age: 35,
        city: 'San Francisco',
        isMarried: false,
      });
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { context: 'renovate.json' },
        'File contents are invalid JSONC but parse using JSON5. Support for this will be removed in a future release so please change to a support .json5 file name or ensure correct JSON syntax.',
      );
    });

    it('does not warn if filename ends with .jsonc', () => {
      parseJson(validJsoncString, 'renovate.jsonc');
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('does not warn if filename ends with .json5', () => {
      parseJson(onlyJson5parsableString, 'renovate.json5');
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('parseJsonc', () => {
    it('returns parsed jsonc', () => {
      expect(parseJson(validJsoncString, 'renovate.jsonc')).toEqual({
        name: 'John Doe',
        age: 30,
        city: 'New York',
      });
    });

    it('throws error for invalid jsonc', () => {
      expect(() => parseJson(invalidJsonString, 'renovate.jsonc')).toThrow();
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  parseActionReference,
  parseComment,
  parseQuote,
  parseUsesLine,
} from './parse.ts';

describe('modules/manager/github-actions/parse', () => {
  describe('parseActionReference', () => {
    it('returns null for empty string', () => {
      expect(parseActionReference('')).toBeNull();
    });

    describe('docker references', () => {
      it('returns null for empty docker reference', () => {
        expect(parseActionReference('docker://')).toBeNull();
      });

      it('parses docker image with digest', () => {
        expect(parseActionReference('docker://alpine@sha256:abc123')).toEqual({
          kind: 'docker',
          image: 'alpine',
          digest: 'sha256:abc123',
          originalRef: 'alpine@sha256:abc123',
        });
      });

      it('parses docker image with tag', () => {
        expect(parseActionReference('docker://alpine:3.18')).toEqual({
          kind: 'docker',
          image: 'alpine',
          tag: '3.18',
          originalRef: 'alpine:3.18',
        });
      });

      it('parses docker image with registry port and tag', () => {
        expect(
          parseActionReference(
            'docker://registry.example.com:5000/alpine:3.18',
          ),
        ).toEqual({
          kind: 'docker',
          image: 'registry.example.com:5000/alpine',
          tag: '3.18',
          originalRef: 'registry.example.com:5000/alpine:3.18',
        });
      });

      it('parses docker image without tag or digest', () => {
        expect(parseActionReference('docker://alpine')).toEqual({
          kind: 'docker',
          image: 'alpine',
          originalRef: 'alpine',
        });
      });

      it('parses docker image with registry but no tag', () => {
        expect(parseActionReference('docker://ghcr.io/owner/image')).toEqual({
          kind: 'docker',
          image: 'ghcr.io/owner/image',
          originalRef: 'ghcr.io/owner/image',
        });
      });
    });

    describe('local references', () => {
      it('parses ./ local reference', () => {
        expect(parseActionReference('./path/to/action')).toEqual({
          kind: 'local',
          path: './path/to/action',
        });
      });

      it('parses ../ local reference', () => {
        expect(parseActionReference('../other/action')).toEqual({
          kind: 'local',
          path: '../other/action',
        });
      });
    });

    describe('repository references', () => {
      it('returns null for invalid format', () => {
        expect(parseActionReference('invalid')).toBeNull();
        expect(parseActionReference('owner/repo')).toBeNull();
      });

      it('parses owner/repo@ref with default hostname', () => {
        expect(parseActionReference('actions/checkout@v4')).toEqual({
          kind: 'repository',
          hostname: 'github.com',
          isExplicitHostname: false,
          owner: 'actions',
          repo: 'checkout',
          path: undefined,
          ref: 'v4',
        });
      });

      it('parses owner/repo/path@ref', () => {
        expect(parseActionReference('owner/repo/sub/path@main')).toEqual({
          kind: 'repository',
          hostname: 'github.com',
          isExplicitHostname: false,
          owner: 'owner',
          repo: 'repo',
          path: 'sub/path',
          ref: 'main',
        });
      });

      it('parses https://host/owner/repo@ref with explicit hostname', () => {
        expect(
          parseActionReference('https://gitea.example.com/owner/repo@v1'),
        ).toEqual({
          kind: 'repository',
          hostname: 'gitea.example.com',
          isExplicitHostname: true,
          owner: 'owner',
          repo: 'repo',
          path: undefined,
          ref: 'v1',
        });
      });

      it('parses https://host/owner/repo/path@ref', () => {
        expect(
          parseActionReference(
            'https://github.enterprise.com/org/repo/workflow.yml@main',
          ),
        ).toEqual({
          kind: 'repository',
          hostname: 'github.enterprise.com',
          isExplicitHostname: true,
          owner: 'org',
          repo: 'repo',
          path: 'workflow.yml',
          ref: 'main',
        });
      });
    });
  });

  describe('parseComment', () => {
    it('returns ratchetExclude for ratchet:exclude', () => {
      expect(parseComment('ratchet:exclude')).toEqual({ ratchetExclude: true });
      expect(parseComment('  ratchet:exclude  ')).toEqual({
        ratchetExclude: true,
      });
    });

    it('returns empty object for no match', () => {
      expect(parseComment('')).toEqual({});
      expect(parseComment('some random comment')).toEqual({});
    });

    it('parses pinned version with tag= prefix', () => {
      const result = parseComment(' tag=v1.2.3');
      expect(result).toEqual({
        index: 0,
        matchedString: ' tag=v1.2.3',
        pinnedVersion: 'v1.2.3',
      });
    });

    it('parses pinned version with pin prefix', () => {
      const result = parseComment('pin v2');
      expect(result).toEqual({
        index: 0,
        matchedString: 'pin v2',
        pinnedVersion: 'v2',
      });
    });

    it('parses pinned version with renovate: prefix', () => {
      const result = parseComment('renovate: pin v3.0.0');
      expect(result).toEqual({
        index: 0,
        matchedString: 'renovate: pin v3.0.0',
        pinnedVersion: 'v3.0.0',
      });
    });

    it('parses pinned version with renovate:pin prefix', () => {
      const result = parseComment('renovate:pin v3.0.0');
      expect(result).toEqual({
        index: 0,
        matchedString: 'renovate:pin v3.0.0',
        pinnedVersion: 'v3.0.0',
      });
    });

    it('parses bare version', () => {
      const result = parseComment('v1');
      expect(result).toEqual({
        index: 0,
        matchedString: 'v1',
        pinnedVersion: 'v1',
      });
    });

    it('parses version with @ prefix', () => {
      const result = parseComment('@v4.1.0');
      expect(result).toEqual({
        index: 0,
        matchedString: '@v4.1.0',
        pinnedVersion: 'v4.1.0',
      });
    });

    it('parses ratchet pinned version', () => {
      const result = parseComment('ratchet:actions/checkout@v4');
      expect(result).toEqual({
        index: 0,
        matchedString: 'ratchet:actions/checkout@v4',
        pinnedVersion: 'v4',
      });
    });

    it('parses version without v prefix', () => {
      const result = parseComment('1.2.3');
      expect(result).toEqual({
        index: 0,
        matchedString: '1.2.3',
        pinnedVersion: '1.2.3',
      });
    });

    it('parses version with leading whitespace', () => {
      const result = parseComment('   v1.0');
      expect(result).toEqual({
        index: 0,
        matchedString: '   v1.0',
        pinnedVersion: 'v1.0',
      });
    });

    it('parses prefixed version like node/v20', () => {
      const result = parseComment('node/v20');
      expect(result).toEqual({
        index: 0,
        matchedString: 'node/v20',
        pinnedVersion: 'node/v20',
      });
    });
  });

  describe('parseQuote', () => {
    it('returns empty quote for unquoted string', () => {
      expect(parseQuote('value')).toEqual({ value: 'value', quote: '' });
    });

    it('returns empty quote for empty string', () => {
      expect(parseQuote('')).toEqual({ value: '', quote: '' });
    });

    it('returns empty quote for single char', () => {
      expect(parseQuote('a')).toEqual({ value: 'a', quote: '' });
    });

    it('parses double quoted string', () => {
      expect(parseQuote('"value"')).toEqual({ value: 'value', quote: '"' });
    });

    it('parses single quoted string', () => {
      expect(parseQuote("'value'")).toEqual({ value: 'value', quote: "'" });
    });

    it('handles whitespace around quotes', () => {
      expect(parseQuote('  "value"  ')).toEqual({ value: 'value', quote: '"' });
    });

    it('returns empty quote for mismatched quotes', () => {
      expect(parseQuote('"value\'')).toEqual({ value: '"value\'', quote: '' });
      expect(parseQuote('\'value"')).toEqual({ value: '\'value"', quote: '' });
    });

    it('returns empty quote for only opening quote', () => {
      expect(parseQuote('"value')).toEqual({ value: '"value', quote: '' });
    });
  });

  describe('parseUsesLine', () => {
    it('returns null for non-uses lines', () => {
      expect(parseUsesLine('name: test')).toBeNull();
      expect(parseUsesLine('run: echo hello')).toBeNull();
      expect(parseUsesLine('')).toBeNull();
      expect(parseUsesLine('uses: value')).toBeNull();
    });

    it('returns null when value is only a comment', () => {
      expect(parseUsesLine('      uses: # only comment')).toBeNull();
    });

    it('parses simple uses line without comment', () => {
      const result = parseUsesLine('      uses: actions/checkout@v4');
      expect(result).toEqual({
        actionRef: {
          hostname: 'github.com',
          isExplicitHostname: false,
          kind: 'repository',
          owner: 'actions',
          path: undefined,
          ref: 'v4',
          repo: 'checkout',
        },
        commentData: {},
        commentPrecedingWhitespace: '',
        commentString: '',
        indentation: '      ',
        quote: '',
        replaceString: 'actions/checkout@v4',
        usesPrefix: '      uses: ',
      });
    });

    it('parses uses line with - prefix', () => {
      const result = parseUsesLine('      - uses: actions/checkout@v4');
      expect(result).toEqual({
        actionRef: {
          hostname: 'github.com',
          isExplicitHostname: false,
          kind: 'repository',
          owner: 'actions',
          path: undefined,
          ref: 'v4',
          repo: 'checkout',
        },
        commentData: {},
        commentPrecedingWhitespace: '',
        commentString: '',
        indentation: '      - ',
        quote: '',
        replaceString: 'actions/checkout@v4',
        usesPrefix: '      - uses: ',
      });
    });

    it('parses uses line with comment', () => {
      const result = parseUsesLine('      uses: actions/checkout@abc123 # v4');
      expect(result).toEqual({
        actionRef: {
          hostname: 'github.com',
          isExplicitHostname: false,
          kind: 'repository',
          owner: 'actions',
          path: undefined,
          ref: 'abc123',
          repo: 'checkout',
        },
        commentData: {
          index: 0,
          matchedString: ' v4',
          pinnedVersion: 'v4',
        },
        commentPrecedingWhitespace: ' ',
        commentString: '# v4',
        indentation: '      ',
        quote: '',
        replaceString: 'actions/checkout@abc123',
        usesPrefix: '      uses: ',
      });
    });

    it('parses uses line with multiple spaces before comment', () => {
      const result = parseUsesLine(
        '      uses: actions/checkout@abc123   # v4',
      );
      expect(result).toEqual({
        actionRef: {
          hostname: 'github.com',
          isExplicitHostname: false,
          kind: 'repository',
          owner: 'actions',
          path: undefined,
          ref: 'abc123',
          repo: 'checkout',
        },
        commentData: {
          index: 0,
          matchedString: ' v4',
          pinnedVersion: 'v4',
        },
        commentPrecedingWhitespace: '   ',
        commentString: '# v4',
        indentation: '      ',
        quote: '',
        replaceString: 'actions/checkout@abc123',
        usesPrefix: '      uses: ',
      });
    });

    it('parses double quoted value', () => {
      const result = parseUsesLine('      uses: "actions/checkout@v4"');
      expect(result).toEqual({
        actionRef: {
          hostname: 'github.com',
          isExplicitHostname: false,
          kind: 'repository',
          owner: 'actions',
          path: undefined,
          ref: 'v4',
          repo: 'checkout',
        },
        commentData: {},
        commentPrecedingWhitespace: '',
        commentString: '',
        indentation: '      ',
        quote: '"',
        replaceString: '"actions/checkout@v4"',
        usesPrefix: '      uses: ',
      });
    });

    it('parses single quoted value', () => {
      const result = parseUsesLine("      uses: 'actions/checkout@v4'");
      expect(result).toEqual({
        actionRef: {
          hostname: 'github.com',
          isExplicitHostname: false,
          kind: 'repository',
          owner: 'actions',
          path: undefined,
          ref: 'v4',
          repo: 'checkout',
        },
        commentData: {},
        commentPrecedingWhitespace: '',
        commentString: '',
        indentation: '      ',
        quote: "'",
        replaceString: "'actions/checkout@v4'",
        usesPrefix: '      uses: ',
      });
    });

    it('parses quoted value with comment', () => {
      const result = parseUsesLine('      uses: "owner/repo@abc123" # v1.0.0');
      expect(result).toEqual({
        actionRef: {
          hostname: 'github.com',
          isExplicitHostname: false,
          kind: 'repository',
          owner: 'owner',
          path: undefined,
          ref: 'abc123',
          repo: 'repo',
        },
        commentData: {
          index: 0,
          matchedString: ' v1.0.0',
          pinnedVersion: 'v1.0.0',
        },
        commentPrecedingWhitespace: ' ',
        commentString: '# v1.0.0',
        indentation: '      ',
        quote: '"',
        replaceString: '"owner/repo@abc123"',
        usesPrefix: '      uses: ',
      });
    });

    it('parses docker action', () => {
      const result = parseUsesLine('      uses: docker://alpine:3.18');
      expect(result).toEqual({
        actionRef: {
          image: 'alpine',
          kind: 'docker',
          originalRef: 'alpine:3.18',
          tag: '3.18',
        },
        commentData: {},
        commentPrecedingWhitespace: '',
        commentString: '',
        indentation: '      ',
        quote: '',
        replaceString: 'docker://alpine:3.18',
        usesPrefix: '      uses: ',
      });
    });

    it('parses local action', () => {
      const result = parseUsesLine('      uses: ./local/action');
      expect(result).toEqual({
        actionRef: {
          kind: 'local',
          path: './local/action',
        },
        commentData: {},
        commentPrecedingWhitespace: '',
        commentString: '',
        indentation: '      ',
        quote: '',
        replaceString: './local/action',
        usesPrefix: '      uses: ',
      });
    });

    it('handles ratchet:exclude comment', () => {
      const result = parseUsesLine(
        '      uses: actions/checkout@v4 # ratchet:exclude',
      );
      expect(result).toEqual({
        actionRef: {
          hostname: 'github.com',
          isExplicitHostname: false,
          kind: 'repository',
          owner: 'actions',
          path: undefined,
          ref: 'v4',
          repo: 'checkout',
        },
        commentData: {
          ratchetExclude: true,
        },
        commentPrecedingWhitespace: ' ',
        commentString: '# ratchet:exclude',
        indentation: '      ',
        quote: '',
        replaceString: 'actions/checkout@v4',
        usesPrefix: '      uses: ',
      });
    });

    it('handles unrecognized comment', () => {
      const result = parseUsesLine(
        '      uses: actions/checkout@v4 # unrelated comment',
      );
      expect(result).toEqual({
        actionRef: {
          hostname: 'github.com',
          isExplicitHostname: false,
          kind: 'repository',
          owner: 'actions',
          path: undefined,
          ref: 'v4',
          repo: 'checkout',
        },
        commentData: {},
        commentPrecedingWhitespace: ' ',
        commentString: '# unrelated comment',
        indentation: '      ',
        quote: '',
        replaceString: 'actions/checkout@v4',
        usesPrefix: '      uses: ',
      });
    });

    it('returns null actionRef for invalid action', () => {
      const result = parseUsesLine('      uses: invalid-no-at-symbol');
      expect(result).toEqual({
        actionRef: null,
        commentData: {},
        commentPrecedingWhitespace: '',
        commentString: '',
        indentation: '      ',
        quote: '',
        replaceString: 'invalid-no-at-symbol',
        usesPrefix: '      uses: ',
      });
    });
  });
});

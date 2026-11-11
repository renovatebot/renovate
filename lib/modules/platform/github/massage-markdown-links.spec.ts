import {
  massageCommitMessageLinks,
  massageMarkdownLinks,
} from './massage-markdown-links.ts';

describe('modules/platform/github/massage-markdown-links', () => {
  it('performs multiple replacements', () => {
    const input = [
      'Link [foo/bar#1](https://github.com/foo/bar/pull/1) points to https://github.com/foo/bar/pull/1.',
      'URL https://github.com/foo/bar/pull/1 becomes [foo/bar#1](https://github.com/foo/bar/pull/1).',
    ].join('\n');
    const res = massageMarkdownLinks(input);
    expect(res).toEqual(
      [
        'Link [foo/bar#1](https://redirect.github.com/foo/bar/pull/1) points to [https://github.com/foo/bar/pull/1](https://redirect.github.com/foo/bar/pull/1).',
        'URL [https://github.com/foo/bar/pull/1](https://redirect.github.com/foo/bar/pull/1) becomes [foo/bar#1](https://redirect.github.com/foo/bar/pull/1).',
      ].join('\n'),
    );
  });

  it.each`
    input
    ${'github.com'}
    ${'github.com/foo/bar'}
    ${'github.com/foo/bar/'}
    ${'github.com/foo/bar/discussions'}
    ${'github.com/foo/bar/issues'}
    ${'github.com/foo/bar/pull'}
    ${'github.com/foo/bar/discussions/'}
    ${'github.com/foo/bar/issues/'}
    ${'github.com/foo/bar/pull/'}
    ${'www.github.com'}
    ${'www.github.com/foo/bar'}
    ${'www.github.com/foo/bar/'}
    ${'www.github.com/foo/bar/discussions'}
    ${'www.github.com/foo/bar/issues'}
    ${'www.github.com/foo/bar/pull'}
    ${'www.github.com/foo/bar/discussions/'}
    ${'www.github.com/foo/bar/issues/'}
    ${'www.github.com/foo/bar/pull/'}
    ${'https://github.com'}
    ${'https://github.com/foo/bar'}
    ${'https://github.com/foo/bar/'}
    ${'https://github.com/foo/bar/discussions'}
    ${'https://github.com/foo/bar/issues'}
    ${'https://github.com/foo/bar/pull'}
    ${'https://github.com/foo/bar/discussions/'}
    ${'https://github.com/foo/bar/issues/'}
    ${'https://github.com/foo/bar/pull/'}
    ${'api.github.com'}
    ${'api.github.com/foo/bar/issues/1'}
    ${'https://api.github.com/foo/bar/issues/1'}
    ${'redirect.github.com'}
    ${'www.redirect.github.com'}
    ${'https://redirect.github.com/foo/bar/releases/tag/v0.20.3'}
    ${'https://redirect.github.com/foo/bar/compare/v0.20.2...v0.20.3'}
  `('Unchanged: $input', ({ input }: { input: string }) => {
    const inputText = `Foo ${input}, bar.`;
    expect(massageMarkdownLinks(inputText)).toEqual(inputText);

    const inputLink = `[foobar](${input})`;
    expect(massageMarkdownLinks(inputLink)).toEqual(inputLink);
  });

  it.each`
    input                                                                                     | output
    ${'github.com/foo/bar/discussions/1'}                                                     | ${'[github.com/foo/bar/discussions/1](redirect.github.com/foo/bar/discussions/1)'}
    ${'github.com/foo/bar/issues/1'}                                                          | ${'[github.com/foo/bar/issues/1](redirect.github.com/foo/bar/issues/1)'}
    ${'github.com/foo/bar/pull/1'}                                                            | ${'[github.com/foo/bar/pull/1](redirect.github.com/foo/bar/pull/1)'}
    ${'github.com/Foo/bar/pull/1'}                                                            | ${'[github.com/Foo/bar/pull/1](redirect.github.com/Foo/bar/pull/1)'}
    ${'www.github.com/foo/bar.foo/pull/1'}                                                    | ${'[www.github.com/foo/bar.foo/pull/1](redirect.github.com/foo/bar.foo/pull/1)'}
    ${'www.github.com/foo/bar/discussions/1'}                                                 | ${'[www.github.com/foo/bar/discussions/1](redirect.github.com/foo/bar/discussions/1)'}
    ${'www.github.com/foo/bar/issues/1'}                                                      | ${'[www.github.com/foo/bar/issues/1](redirect.github.com/foo/bar/issues/1)'}
    ${'www.github.com/foo/bar/pull/1'}                                                        | ${'[www.github.com/foo/bar/pull/1](redirect.github.com/foo/bar/pull/1)'}
    ${'https://github.com/foo/bar/discussions/1'}                                             | ${'[https://github.com/foo/bar/discussions/1](https://redirect.github.com/foo/bar/discussions/1)'}
    ${'https://github.com/foo/bar/issues/1'}                                                  | ${'[https://github.com/foo/bar/issues/1](https://redirect.github.com/foo/bar/issues/1)'}
    ${'https://github.com/foo/bar/pull/1'}                                                    | ${'[https://github.com/foo/bar/pull/1](https://redirect.github.com/foo/bar/pull/1)'}
    ${'https://github.com/foo/bar/discussions/1#comment-123'}                                 | ${'[https://github.com/foo/bar/discussions/1#comment-123](https://redirect.github.com/foo/bar/discussions/1#comment-123)'}
    ${'https://github.com/foo/bar/issues/1#comment-123'}                                      | ${'[https://github.com/foo/bar/issues/1#comment-123](https://redirect.github.com/foo/bar/issues/1#comment-123)'}
    ${'https://github.com/foo/bar/pull/1#comment-123'}                                        | ${'[https://github.com/foo/bar/pull/1#comment-123](https://redirect.github.com/foo/bar/pull/1#comment-123)'}
    ${'[github.com/foo/bar/discussions/1](github.com/foo/bar/discussions/1)'}                 | ${'[github.com/foo/bar/discussions/1](redirect.github.com/foo/bar/discussions/1)'}
    ${'[github.com/foo/bar/issues/1](github.com/foo/bar/issues/1)'}                           | ${'[github.com/foo/bar/issues/1](redirect.github.com/foo/bar/issues/1)'}
    ${'[github.com/foo/bar/pull/1](github.com/foo/bar/pull/1)'}                               | ${'[github.com/foo/bar/pull/1](redirect.github.com/foo/bar/pull/1)'}
    ${'[www.github.com/foo/bar/discussions/1](www.github.com/foo/bar/discussions/1)'}         | ${'[www.github.com/foo/bar/discussions/1](redirect.github.com/foo/bar/discussions/1)'}
    ${'[www.github.com/foo/bar/issues/1](www.github.com/foo/bar/issues/1)'}                   | ${'[www.github.com/foo/bar/issues/1](redirect.github.com/foo/bar/issues/1)'}
    ${'[www.github.com/foo/bar.foo/pull/1](www.github.com/foo/bar.foo/pull/1)'}               | ${'[www.github.com/foo/bar.foo/pull/1](redirect.github.com/foo/bar.foo/pull/1)'}
    ${'[www.github.com/foo/bar/pull/1](www.github.com/foo/bar/pull/1)'}                       | ${'[www.github.com/foo/bar/pull/1](redirect.github.com/foo/bar/pull/1)'}
    ${'[https://github.com/foo/bar/discussions/1](https://github.com/foo/bar/discussions/1)'} | ${'[https://github.com/foo/bar/discussions/1](https://redirect.github.com/foo/bar/discussions/1)'}
    ${'[https://github.com/foo/bar/issues/1](https://github.com/foo/bar/issues/1)'}           | ${'[https://github.com/foo/bar/issues/1](https://redirect.github.com/foo/bar/issues/1)'}
    ${'[https://github.com/foo/bar/pull/1](https://github.com/foo/bar/pull/1)'}               | ${'[https://github.com/foo/bar/pull/1](https://redirect.github.com/foo/bar/pull/1)'}
  `(
    '$input -> $output',
    ({ input, output }: { input: string; output: string }) => {
      expect(massageMarkdownLinks(input)).toEqual(output);
    },
  );

  describe('massageCommitMessageLinks', () => {
    it('replaces links in release notes', () => {
      const input = [
        'chore(deps): update dependency renovate to v44.220.0',
        '',
        '- **config:** add option ([#43916](https://github.com/renovatebot/renovate/issues/43916)) ([18bfe0a](https://github.com/renovatebot/renovate/commit/18bfe0a)), closes [#1](https://github.com/renovatebot/renovate/pull/1)',
      ].join('\n');

      expect(massageCommitMessageLinks(input)).toBe(
        [
          'chore(deps): update dependency renovate to v44.220.0',
          '',
          '- **config:** add option ([#43916](https://redirect.github.com/renovatebot/renovate/issues/43916)) ([18bfe0a](https://github.com/renovatebot/renovate/commit/18bfe0a)), closes [#1](https://redirect.github.com/renovatebot/renovate/pull/1)',
        ].join('\n'),
      );
    });

    it.each`
      input                                                   | output
      ${'https://github.com/foo/bar/discussions/1'}           | ${'https://redirect.github.com/foo/bar/discussions/1'}
      ${'https://github.com/foo/bar/issues/1'}                | ${'https://redirect.github.com/foo/bar/issues/1'}
      ${'https://github.com/foo/bar/pull/1'}                  | ${'https://redirect.github.com/foo/bar/pull/1'}
      ${'https://github.com/foo/bar/pull/1#issuecomment-123'} | ${'https://redirect.github.com/foo/bar/pull/1#issuecomment-123'}
      ${'https://www.github.com/foo/bar.foo/pull/1'}          | ${'https://redirect.github.com/foo/bar.foo/pull/1'}
      ${'http://GitHub.com/Foo/bar/issues/1'}                 | ${'http://redirect.github.com/Foo/bar/issues/1'}
      ${'https://redirect.github.com/foo/bar/issues/1'}       | ${'https://redirect.github.com/foo/bar/issues/1'}
      ${'https://api.github.com/repos/foo/bar/issues/1'}      | ${'https://api.github.com/repos/foo/bar/issues/1'}
      ${'https://github.com/foo/bar/releases/tag/1.0.0'}      | ${'https://github.com/foo/bar/releases/tag/1.0.0'}
      ${'https://github.com/foo/bar/compare/1.0.0...2.0.0'}   | ${'https://github.com/foo/bar/compare/1.0.0...2.0.0'}
      ${'github.com/foo/bar/issues/1'}                        | ${'github.com/foo/bar/issues/1'}
      ${'foo/bar#1'}                                          | ${'foo/bar#1'}
    `(
      '$input -> $output',
      ({ input, output }: { input: string; output: string }) => {
        expect(massageCommitMessageLinks(input)).toBe(output);
      },
    );
  });
});

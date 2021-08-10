import { getName } from '../../../test/util';
import { massageMarkdownLinks } from './massage-markdown-links';

describe(getName(), () => {
  const table = [
    ['github.com', '[github.com](togithub.com)'],
    ['www.github.com', '[www.github.com](www.togithub.com)'],
    ['api.github.com', 'api.github.com'],
    ['togithub.com', 'togithub.com'],
    ['foobartogithub.com', 'foobartogithub.com'],
    ['[github.com](github.com)', '[github.com](togithub.com)'],
    ['[github.com](www.github.com)', '[github.com](www.togithub.com)'],
    [
      '[github.com](https://github.com/foo/bar)',
      '[github.com](https://togithub.com/foo/bar)',
    ],
    [
      'https://github.com/foo/bar',
      '[https://github.com/foo/bar](https://togithub.com/foo/bar)',
    ],
    [
      '[foobar](https://github.com/foo/bar)',
      '[foobar](https://togithub.com/foo/bar)',
    ],
    [
      '[https://github.com/foo/bar](https://github.com/foo/bar)',
      '[https://github.com/foo/bar](https://togithub.com/foo/bar)',
    ],
  ];

  test.each(table)('%s -> %s', (input, output) => {
    const res = massageMarkdownLinks(input).trimRight();
    expect(res).toEqual(output);
  });
});

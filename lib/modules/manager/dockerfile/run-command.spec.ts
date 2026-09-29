import { codeBlock } from 'common-tags';
import { logger } from '../../../logger/index.ts';
import { parseRunCommands } from './run-command.ts';

const escapeChar = '\\\\';

describe('modules/manager/dockerfile/run-command', () => {
  describe('parseRunCommands()', () => {
    it('ignores instructions which are not RUN', () => {
      expect(parseRunCommands('FROM alpine:3.21', escapeChar, ['apk'])).toEqual(
        [],
      );
      expect(
        parseRunCommands('CMD ["apk", "add", "bash"]', escapeChar, ['apk']),
      ).toEqual([]);
      expect(
        parseRunCommands('ENV APK_VERSION=2.14.6', escapeChar, ['apk']),
      ).toEqual([]);
    });

    it('ignores a RUN instruction which does not mention the command', () => {
      expect(
        parseRunCommands('RUN apt-get install -y bash', escapeChar, ['apk']),
      ).toEqual([]);
    });

    it('ignores a command which merely mentions the name', () => {
      expect(
        parseRunCommands('RUN rm -rf /var/cache/apk/*', escapeChar, ['apk']),
      ).toEqual([]);
    });

    it('returns the arguments of the command', () => {
      expect(
        parseRunCommands('RUN apk add --no-cache bash=5.2.37-r2', escapeChar, [
          'apk',
        ]),
      ).toEqual([['add', '--no-cache', 'bash=5.2.37-r2']]);
    });

    it('returns no arguments for a bare command', () => {
      expect(parseRunCommands('RUN apk', escapeChar, ['apk'])).toEqual([[]]);
    });

    it('matches any of the given command names', () => {
      expect(
        parseRunCommands('RUN apt-get install -y curl', escapeChar, [
          'apt',
          'apt-get',
        ]),
      ).toEqual([['install', '-y', 'curl']]);
      expect(
        parseRunCommands('RUN apt install -y curl', escapeChar, [
          'apt',
          'apt-get',
        ]),
      ).toEqual([['install', '-y', 'curl']]);
    });

    it('matches a command given by its path', () => {
      expect(
        parseRunCommands('RUN /sbin/apk add bash', escapeChar, ['apk']),
      ).toEqual([['add', 'bash']]);
    });

    it('matches a command prefixed by variable assignments', () => {
      expect(
        parseRunCommands('RUN DEBUG=1 apk add bash', escapeChar, ['apk']),
      ).toEqual([['add', 'bash']]);
    });

    it.each`
      wrapper
      ${'sudo'}
      ${'chroot /mnt'}
      ${'timeout 30'}
      ${'env DEBIAN_FRONTEND=noninteractive'}
    `('matches a command run through $wrapper', ({ wrapper }) => {
      expect(
        parseRunCommands(`RUN ${wrapper} apk add bash`, escapeChar, ['apk']),
      ).toEqual([['add', 'bash']]);
    });

    it('skips the RUN flags and the ONBUILD prefix', () => {
      expect(
        parseRunCommands(
          'ONBUILD RUN --mount=type=cache,target=/var/cache/apk --network=default apk add bash',
          escapeChar,
          ['apk'],
        ),
      ).toEqual([['add', 'bash']]);
    });

    it('strips quotes from the arguments', () => {
      expect(
        parseRunCommands(
          `RUN apk add "nginx=1.26.2-r0" 'curl=8.12.1-r1'`,
          escapeChar,
          ['apk'],
        ),
      ).toEqual([['add', 'nginx=1.26.2-r0', 'curl=8.12.1-r1']]);
    });

    it('joins line continuations', () => {
      const instruction = codeBlock`
        RUN apk add --no-cache \\
                bash=5.2.37-r2 \\
                curl=8.12.1-r1`;

      expect(parseRunCommands(instruction, escapeChar, ['apk'])).toEqual([
        ['add', '--no-cache', 'bash=5.2.37-r2', 'curl=8.12.1-r1'],
      ]);
    });

    it('supports the backtick escape character', () => {
      expect(
        parseRunCommands('RUN apk add `\n    bash=5.2.37-r2', '`', ['apk']),
      ).toEqual([['add', 'bash=5.2.37-r2']]);
    });

    it('handles CRLF line continuations', () => {
      expect(
        parseRunCommands('RUN apk add \\\r\n    bash=5.2.37-r2', escapeChar, [
          'apk',
        ]),
      ).toEqual([['add', 'bash=5.2.37-r2']]);
    });

    it('drops Dockerfile comments inside a line continuation', () => {
      const instruction = codeBlock`
        RUN apk add --no-cache \\
            # bash is needed by our entrypoint
            bash=5.2.37-r2`;

      expect(parseRunCommands(instruction, escapeChar, ['apk'])).toEqual([
        ['add', '--no-cache', 'bash=5.2.37-r2'],
      ]);
    });

    it('stops at a shell comment', () => {
      expect(
        parseRunCommands(
          'RUN apk add bash=5.2.37-r2 # apk add curl=8.12.1-r1',
          escapeChar,
          ['apk'],
        ),
      ).toEqual([['add', 'bash=5.2.37-r2']]);
    });

    it.each`
      separator
      ${'&&'}
      ${'||'}
      ${';'}
      ${'|'}
      ${'&'}
    `('splits the commands on $separator', ({ separator }) => {
      expect(
        parseRunCommands(
          `RUN apk update ${separator} apk add bash`,
          escapeChar,
          ['apk'],
        ),
      ).toEqual([['update'], ['add', 'bash']]);
    });

    it.each`
      separator
      ${'('}
      ${')'}
      ${'{'}
      ${'}'}
    `('splits the commands on $separator', ({ separator }) => {
      expect(
        parseRunCommands(
          `RUN apk update ${separator} apk add bash`,
          escapeChar,
          ['apk'],
        ),
      ).toEqual([['update'], ['add', 'bash']]);
    });

    it('splits on a separator which is not preceded by whitespace', () => {
      expect(
        parseRunCommands(
          'RUN for iter in {1..10}; do apk add bash; done',
          escapeChar,
          ['apk'],
        ),
      ).toEqual([['add', 'bash']]);
    });

    it('returns each invocation in the order they were run', () => {
      expect(
        parseRunCommands(
          'RUN apk add bash && apk del .build-deps && apk add curl',
          escapeChar,
          ['apk'],
        ),
      ).toEqual([
        ['add', 'bash'],
        ['del', '.build-deps'],
        ['add', 'curl'],
      ]);
    });

    it('handles a command it cannot tokenize', () => {
      expect(
        parseRunCommands('RUN apk add "bash=5.2.37-r2', escapeChar, ['apk']),
      ).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        { err: expect.anything(), command: 'apk add "bash=5.2.37-r2' },
        'Failed to tokenize Dockerfile RUN command',
      );
    });
  });
});

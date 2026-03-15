import type { CommandWithOptions } from './types.ts';
import { asRawCommands, isCommandWithOptions } from './utils.ts';

describe('util/exec/utils', () => {
  describe('isCommandWithOptions', () => {
    describe('when command is an array of 1 command', () => {
      it('is a CommandWithOptions', () => {
        const valid: CommandWithOptions = {
          command: ['ls'],
        };

        expect(isCommandWithOptions(valid)).toBeTrue();
      });
    });

    describe('when command is an array of many command', () => {
      it('is a CommandWithOptions', () => {
        const valid: CommandWithOptions = {
          command: ['go', 'mod', 'tidy'],
        };

        expect(isCommandWithOptions(valid)).toBeTrue();
      });
    });

    describe('when command is an empty array', () => {
      it('is not a CommandWithOptions', () => {
        const valid: CommandWithOptions = {
          command: [],
        };

        expect(isCommandWithOptions(valid)).toBeFalse();
      });
    });

    describe('when command is a string', () => {
      it('is not a CommandWithOptions', () => {
        const invalid = {
          command: 'ls -al',
        };

        expect(isCommandWithOptions(invalid)).toBeFalse();
      });
    });

    describe('when command is a mixed array of strings booleans', () => {
      it('is not a CommandWithOptions', () => {
        const invalid = {
          command: ['ls', true, '-l', false],
        };

        expect(isCommandWithOptions(invalid)).toBeFalse();
      });
    });

    describe('when command is an array of booleans', () => {
      it('is not a CommandWithOptions', () => {
        const invalid = {
          command: [true, false],
        };

        expect(isCommandWithOptions(invalid)).toBeFalse();
      });
    });

    describe('when command is valid, and no ignoreFailure is present', () => {
      it('is a CommandWithOptions', () => {
        const valid: CommandWithOptions = {
          command: ['go'],
        };

        expect(isCommandWithOptions(valid)).toBeTrue();
      });
    });

    describe('when command is valid, and ignoreFailure is not a boolean', () => {
      it('is not a CommandWithOptions', () => {
        const invalid = {
          command: ['go'],
          ignoreFailure: 'hello',
        };

        expect(isCommandWithOptions(invalid)).toBeFalse();
      });
    });

    describe('when command is valid, and ignoreFailure=false', () => {
      it('is a CommandWithOptions', () => {
        const valid: CommandWithOptions = {
          command: ['go'],
          ignoreFailure: false,
        };

        expect(isCommandWithOptions(valid)).toBeTrue();
      });
    });

    describe('when command is valid, and ignoreFailure=true', () => {
      it('is a CommandWithOptions', () => {
        const valid: CommandWithOptions = {
          command: ['go'],
          ignoreFailure: true,
        };

        expect(isCommandWithOptions(valid)).toBeTrue();
      });
    });

    describe('when command is valid, and no shell is present', () => {
      it('is a CommandWithOptions', () => {
        const valid: CommandWithOptions = {
          command: ['go'],
        };

        expect(isCommandWithOptions(valid)).toBeTrue();
      });
    });

    describe('when command is valid, and shell is not a string or a boolean', () => {
      it('is not a CommandWithOptions', () => {
        const invalid = {
          command: ['go'],
          shell: 1234.0,
        };

        expect(isCommandWithOptions(invalid)).toBeFalse();
      });
    });

    describe('when command is valid, and shell is an empty string', () => {
      it('is not a CommandWithOptions', () => {
        const invalid = {
          command: ['go'],
          shell: '',
        };

        expect(isCommandWithOptions(invalid)).toBeFalse();
      });
    });

    describe('when command is valid, and shell is a string with only whitespace', () => {
      it('is not a CommandWithOptions', () => {
        const invalid = {
          command: ['go'],
          shell: ' \t\r\n',
        };

        expect(isCommandWithOptions(invalid)).toBeFalse();
      });
    });

    describe('when command is valid, and shell is a non-empty string', () => {
      it('is not a CommandWithOptions', () => {
        const valid: CommandWithOptions = {
          command: ['go'],
          // NOTE that this isn't a likely case, but proves that this works
          shell: 'a',
        };

        expect(isCommandWithOptions(valid)).toBeTrue();
      });
    });

    describe('when command is valid, and shell=false', () => {
      it('is a CommandWithOptions', () => {
        const valid: CommandWithOptions = {
          command: ['go'],
          shell: false,
        };

        expect(isCommandWithOptions(valid)).toBeTrue();
      });
    });

    describe('when command is valid, and shell=true', () => {
      it('is a CommandWithOptions', () => {
        const valid: CommandWithOptions = {
          command: ['go'],
          shell: true,
        };

        expect(isCommandWithOptions(valid)).toBeTrue();
      });
    });
  });

  describe('asRawCommands', () => {
    describe('with a string', () => {
      it('returns array of strings', () => {
        const res = asRawCommands('go mod tidy');

        expect(res).toBeArrayOfSize(1);
        expect(res).toEqual(['go mod tidy']);
      });
    });

    describe('with an array of strings', () => {
      it('returns array of strings', () => {
        const res = asRawCommands(['go mod tidy']);

        expect(res).toBeArrayOfSize(1);
        expect(res).toEqual(['go mod tidy']);
      });
    });

    describe('with many commands', () => {
      it('returns an array of many strings', () => {
        const res = asRawCommands([
          'go mod tidy',
          'make tidy',
          'make generate',
        ]);

        expect(res).toBeArrayOfSize(3);
        expect(res).toEqual(['go mod tidy', 'make tidy', 'make generate']);
      });
    });

    describe('with `CommandWithOptions`', () => {
      it('returns commands from the `CommandWithOptions`', () => {
        const res = asRawCommands([
          {
            command: ['ls'],
            ignoreFailure: true,
          },
          {
            command: ['go', 'mod', 'tidy'],
          },
        ]);

        expect(res).toBeArrayOfSize(2);
        expect(res).toEqual(['ls', 'go mod tidy']);
      });
    });
  });
});

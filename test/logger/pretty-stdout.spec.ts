import chalk from 'chalk';
import * as prettyStdout from '../../lib/logger/pretty-stdout';

describe('logger/pretty-stdout', () => {
  describe('getMeta(rec)', () => {
    it('returns empty string if null rec', () => {
      expect(prettyStdout.getMeta(null as any)).toEqual('');
    });
    it('returns empty string if empty rec', () => {
      expect(prettyStdout.getMeta({} as any)).toEqual('');
    });
    it('returns empty string if no meta fields', () => {
      const rec = {
        foo: 'bar',
      };
      expect(prettyStdout.getMeta(rec as any)).toEqual('');
    });
    it('supports single meta', () => {
      const rec = {
        foo: 'bar',
        repository: 'a/b',
      };
      expect(prettyStdout.getMeta(rec as any)).toEqual(
        chalk.gray(' (repository=a/b)')
      );
    });
    it('supports multi meta', () => {
      const rec = {
        foo: 'bar',
        branch: 'c',
        repository: 'a/b',
        module: 'test',
      };
      expect(prettyStdout.getMeta(rec as any)).toEqual(
        chalk.gray(' (repository=a/b, branch=c) [test]')
      );
    });
  });
  describe('getDetails(rec)', () => {
    it('returns empty string if null rec', () => {
      expect(prettyStdout.getDetails(null as any)).toEqual('');
    });
    it('returns empty string if empty rec', () => {
      expect(prettyStdout.getDetails({} as any)).toEqual('');
    });
    it('returns empty string if all are meta fields', () => {
      const rec = {
        branch: 'bar',
        v: 0,
      };
      expect(prettyStdout.getDetails(rec as any)).toEqual('');
    });
    it('supports a config', () => {
      const rec = {
        v: 0,
        config: {
          a: 'b',
          d: ['e', 'f'],
        },
      };
      expect(prettyStdout.getDetails(rec as any)).toMatchSnapshot();
    });
  });
  describe('formatRecord(rec)', () => {
    it('formats record', () => {
      const rec: prettyStdout.IRecord = {
        level: 10,
        msg: 'test message',
        v: 0,
        config: {
          a: 'b',
          d: ['e', 'f'],
        },
      };
      expect(prettyStdout.formatRecord(rec)).toMatchSnapshot();
    });
  });
});

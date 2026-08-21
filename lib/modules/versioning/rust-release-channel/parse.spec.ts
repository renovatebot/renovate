import { describe, expect, it } from 'vitest';
import { parse } from './parse.ts';

describe('modules/versioning/rust-release-channel/parse', () => {
  describe('channel names', () => {
    it.each`
      input        | expected
      ${'stable'}  | ${{ channel: 'stable' }}
      ${'beta'}    | ${{ channel: 'beta' }}
      ${'nightly'} | ${{ channel: 'nightly' }}
    `('parses "$input" correctly', ({ input, expected }) => {
      expect(parse(input)).toEqual(expected);
    });
  });

  describe('full versions', () => {
    it.each`
      input       | expected
      ${'1.82.0'} | ${{ channel: { major: 1, minor: 82, patch: 0 } }}
      ${'1.0.0'}  | ${{ channel: { major: 1, minor: 0, patch: 0 } }}
      ${'2.5.10'} | ${{ channel: { major: 2, minor: 5, patch: 10 } }}
    `('parses "$input" correctly', ({ input, expected }) => {
      expect(parse(input)).toEqual(expected);
    });
  });

  describe('partial versions (ranges)', () => {
    it.each`
      input     | expected
      ${'1.82'} | ${{ channel: { major: 1, minor: 82 } }}
      ${'1.0'}  | ${{ channel: { major: 1, minor: 0 } }}
      ${'2.5'}  | ${{ channel: { major: 2, minor: 5 } }}
    `('parses "$input" correctly', ({ input, expected }) => {
      expect(parse(input)).toEqual(expected);
    });
  });

  describe('beta versions with number', () => {
    it.each`
      input              | expected
      ${'1.83.0-beta.5'} | ${{ channel: { major: 1, minor: 83, patch: 0, prerelease: { name: 'beta', number: 5 } } }}
      ${'1.83.0-beta.1'} | ${{ channel: { major: 1, minor: 83, patch: 0, prerelease: { name: 'beta', number: 1 } } }}
      ${'2.0.0-beta.10'} | ${{ channel: { major: 2, minor: 0, patch: 0, prerelease: { name: 'beta', number: 10 } } }}
    `('parses "$input" correctly', ({ input, expected }) => {
      expect(parse(input)).toEqual(expected);
    });
  });

  describe('beta ranges (without number)', () => {
    it.each`
      input            | expected
      ${'1.83.0-beta'} | ${{ channel: { major: 1, minor: 83, patch: 0, prerelease: { name: 'beta' } } }}
      ${'2.0.0-beta'}  | ${{ channel: { major: 2, minor: 0, patch: 0, prerelease: { name: 'beta' } } }}
    `('parses "$input" correctly', ({ input, expected }) => {
      expect(parse(input)).toEqual(expected);
    });
  });

  describe('dated channels', () => {
    it.each`
      input                   | expected
      ${'stable-2025-11-24'}  | ${{ channel: 'stable', date: { year: 2025, month: 11, day: 24 } }}
      ${'beta-2025-11-24'}    | ${{ channel: 'beta', date: { year: 2025, month: 11, day: 24 } }}
      ${'nightly-2025-11-24'} | ${{ channel: 'nightly', date: { year: 2025, month: 11, day: 24 } }}
      ${'nightly-2015-05-15'} | ${{ channel: 'nightly', date: { year: 2015, month: 5, day: 15 } }}
      ${'nightly-2014-12-18'} | ${{ channel: 'nightly', date: { year: 2014, month: 12, day: 18 } }}
      ${'nightly-2025-01-01'} | ${{ channel: 'nightly', date: { year: 2025, month: 1, day: 1 } }}
    `('parses "$input" correctly', ({ input, expected }) => {
      expect(parse(input)).toEqual(expected);
    });
  });

  describe('with host triples', () => {
    it.each`
      input                                          | expected
      ${'stable-x86_64-pc-windows-msvc'}             | ${{ channel: 'stable', host: 'x86_64-pc-windows-msvc' }}
      ${'beta-x86_64-unknown-linux-gnu'}             | ${{ channel: 'beta', host: 'x86_64-unknown-linux-gnu' }}
      ${'nightly-x86_64-apple-darwin'}               | ${{ channel: 'nightly', host: 'x86_64-apple-darwin' }}
      ${'1.82.0-x86_64-pc-windows-msvc'}             | ${{ channel: { major: 1, minor: 82, patch: 0 }, host: 'x86_64-pc-windows-msvc' }}
      ${'nightly-2025-11-24-x86_64-pc-windows-msvc'} | ${{ channel: 'nightly', date: { year: 2025, month: 11, day: 24 }, host: 'x86_64-pc-windows-msvc' }}
    `('parses "$input" correctly', ({ input, expected }) => {
      expect(parse(input)).toEqual(expected);
    });
  });

  describe('invalid inputs', () => {
    it.each`
      input         | reason
      ${''}         | ${'empty string'}
      ${'invalid'}  | ${'not a valid format'}
      ${'1.82.0.0'} | ${'too many version parts'}
      ${'1.-1.0'}   | ${'negative version number'}
      ${'1.82.-1'}  | ${'negative version number'}
      ${'a.b.c'}    | ${'non-numeric version'}
    `('returns null for "$input" ($reason)', ({ input }) => {
      expect(parse(input)).toBeNull();
    });
  });
});

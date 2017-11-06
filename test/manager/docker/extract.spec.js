const { extractDependencies } = require('../../../lib/manager/docker/extract');
const logger = require('../../_fixtures/logger');

describe('lib/manager/docker/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {
        logger,
      };
    });
    it('handles naked dep', () => {
      const res = extractDependencies('FROM node\n', config);
      expect(res).toMatchSnapshot();
    });
    it('handles tag', () => {
      const res = extractDependencies('FROM node:8.9.0-alpine\n', config);
      expect(res).toMatchSnapshot();
    });
    it('handles digest', () => {
      const res = extractDependencies(
        'FROM node@sha256:aaaaaaaabbbbbbbbccccccccddddddd\n',
        config
      );
      expect(res).toMatchSnapshot();
    });
    it('handles tag and digest', () => {
      const res = extractDependencies(
        'FROM node:8.9.0@sha256:aaaaaaaabbbbbbbbccccccccddddddd\n',
        config
      );
      expect(res).toMatchSnapshot();
    });
    it('handles from as', () => {
      const res = extractDependencies(
        'FROM node:8.9.0-alpine as base\n',
        config
      );
      expect(res).toMatchSnapshot();
      //  expect(res.currentTag.includes(' ')).toBe(false);
    });
    it('handles comments', () => {
      const res = extractDependencies(
        '# some comment\n# another\n\nFROM node\n',
        config
      );
      expect(res).toMatchSnapshot();
    });
    it('handles custom hosts', () => {
      const res = extractDependencies(
        'FROM registry2.something.info:5005/node:8\n',
        config
      );
      expect(res).toMatchSnapshot();
    });
  });
});

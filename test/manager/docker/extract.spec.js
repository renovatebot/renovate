const { extractDependencies } = require('../../../lib/manager/docker/extract');

describe('lib/manager/docker/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('handles naked dep', () => {
      const res = extractDependencies('FROM node\n', config);
      expect(res).toMatchSnapshot();
    });
    it('is case insensitive', () => {
      const res = extractDependencies('From node\n', config);
      expect(res).toMatchSnapshot();
    });
    it('handles tag', () => {
      const res = extractDependencies('FROM node:8.9.0-alpine\n', config);
      expect(res).toMatchSnapshot();
    });
    it('handles digest', () => {
      const res = extractDependencies(
        'FROM node@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063\n',
        config
      );
      expect(res).toMatchSnapshot();
    });
    it('handles tag and digest', () => {
      const res = extractDependencies(
        'FROM node:8.9.0@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063\n',
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
        'FROM registry2.something.info/node:8\n',
        config
      );
      expect(res).toMatchSnapshot();
      expect(res[0].dockerRegistry).toEqual('registry2.something.info');
    });
    it('handles custom hosts with port', () => {
      const res = extractDependencies(
        'FROM registry2.something.info:5005/node:8\n',
        config
      );
      expect(res).toMatchSnapshot();
      expect(res[0].dockerRegistry).toEqual('registry2.something.info:5005');
    });
    it('handles namespaced images', () => {
      const res = extractDependencies('FROM mynamespace/node:8\n', config);
      expect(res).toMatchSnapshot();
      expect(res[0].dockerRegistry).toBeUndefined();
    });
    it('handles custom hosts with namespace', () => {
      const res = extractDependencies(
        'FROM registry2.something.info/someaccount/node:8\n',
        config
      );
      expect(res).toMatchSnapshot();
      expect(res[0].dockerRegistry).toEqual('registry2.something.info');
      expect(res[0].depName).toEqual('someaccount/node');
    });
    it('handles abnoral spacing', () => {
      const res = extractDependencies(
        'FROM    registry.allmine.info:5005/node:8.7.0\n\n'
      );
      expect(res).toMatchSnapshot();
    });
    it('extracts multiple FROM tags', () => {
      const res = extractDependencies(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nFROM python:3.6-slim\n',
        config
      );
      expect(res).toMatchSnapshot();
    });
  });
});

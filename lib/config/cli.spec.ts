import { getName } from '../../test/util';
import * as datasourceDocker from '../datasource/docker';
import * as cli from './cli';
import getArgv from './config/__fixtures__/argv';
import type { RenovateOptions } from './types';

describe(getName(__filename), () => {
  let argv: string[];
  beforeEach(() => {
    argv = getArgv();
  });
  describe('.getCliName(definition)', () => {
    it('generates CLI value', () => {
      const option: Partial<RenovateOptions> = {
        name: 'oneTwoThree',
      };
      expect(cli.getCliName(option)).toEqual('--one-two-three');
    });
    it('generates returns empty if CLI false', () => {
      const option: Partial<RenovateOptions> = {
        name: 'oneTwoThree',
        cli: false,
      };
      expect(cli.getCliName(option)).toEqual('');
    });
  });
  describe('.getConfig(argv)', () => {
    it('returns empty argv', () => {
      expect(cli.getConfig(argv)).toEqual({});
    });
    it('supports boolean no value', () => {
      argv.push('--recreate-closed');
      expect(cli.getConfig(argv)).toEqual({ recreateClosed: true });
      argv = argv.slice(0, -1);
    });
    it('supports boolean space true', () => {
      argv.push('--recreate-closed');
      argv.push('true');
      expect(cli.getConfig(argv)).toEqual({ recreateClosed: true });
    });
    it('throws exception for invalid boolean value', () => {
      argv.push('--recreate-closed');
      argv.push('badvalue');
      expect(() => cli.getConfig(argv)).toThrow(
        Error(
          "Invalid boolean value: expected 'true' or 'false', but got 'badvalue'"
        )
      );
    });
    it('supports boolean space false', () => {
      argv.push('--recreate-closed');
      argv.push('false');
      expect(cli.getConfig(argv)).toEqual({ recreateClosed: false });
    });
    it('supports boolean equals true', () => {
      argv.push('--recreate-closed=true');
      expect(cli.getConfig(argv)).toEqual({ recreateClosed: true });
    });
    it('supports boolean equals false', () => {
      argv.push('--recreate-closed=false');
      expect(cli.getConfig(argv)).toEqual({ recreateClosed: false });
    });
    it('supports list single', () => {
      argv.push('--labels=a');
      expect(cli.getConfig(argv)).toEqual({ labels: ['a'] });
    });
    it('supports list multiple', () => {
      argv.push('--labels=a,b,c');
      expect(cli.getConfig(argv)).toEqual({ labels: ['a', 'b', 'c'] });
    });
    it('supports string', () => {
      argv.push('--token=a');
      expect(cli.getConfig(argv)).toEqual({ token: 'a' });
    });
    it('supports repositories', () => {
      argv.push('foo');
      argv.push('bar');
      expect(cli.getConfig(argv)).toEqual({ repositories: ['foo', 'bar'] });
    });
    it('parses json lists correctly', () => {
      argv.push(
        `--host-rules=[{"domainName":"docker.io","hostType":"${datasourceDocker.id}","username":"user","password":"password"}]`
      );
      expect(cli.getConfig(argv)).toEqual({
        hostRules: [
          {
            domainName: 'docker.io',
            hostType: datasourceDocker.id,
            username: 'user',
            password: 'password',
          },
        ],
      });
    });
    it('parses [] correctly as empty list of hostRules', () => {
      argv.push(`--host-rules=[]`);
      expect(cli.getConfig(argv)).toEqual({
        hostRules: [],
      });
    });
    it('parses an empty string correctly as empty list of hostRules', () => {
      argv.push(`--host-rules=`);
      expect(cli.getConfig(argv)).toEqual({
        hostRules: [],
      });
    });
    it('migrates --endpoints', () => {
      argv.push(`--endpoints=`);
      expect(cli.getConfig(argv)).toEqual({
        hostRules: [],
      });
    });
    it('parses json object correctly when empty', () => {
      argv.push(`--onboarding-config=`);
      expect(cli.getConfig(argv)).toEqual({
        onboardingConfig: {},
      });
    });
    it('parses json {} object correctly', () => {
      argv.push(`--onboarding-config={}`);
      expect(cli.getConfig(argv)).toEqual({
        onboardingConfig: {},
      });
    });
    it('parses json object correctly', () => {
      argv.push(`--onboarding-config={"extends": ["config:base"]}`);
      expect(cli.getConfig(argv)).toEqual({
        onboardingConfig: {
          extends: ['config:base'],
        },
      });
    });
    it('throws exception for invalid json object', () => {
      argv.push('--onboarding-config=Hello_World');
      expect(() => cli.getConfig(argv)).toThrow(
        Error("Invalid JSON value: 'Hello_World'")
      );
    });
  });
});

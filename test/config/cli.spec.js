const cli = require('../../lib/config/cli.js');
const getArgv = require('./config/_fixtures/argv');

describe('config/cli', () => {
  let argv;
  beforeEach(() => {
    argv = getArgv();
  });
  describe('.getCliName(definition)', () => {
    it('generates CLI value', () => {
      const option = {
        name: 'oneTwoThree',
      };
      cli.getCliName(option).should.eql('--one-two-three');
    });
    it('generates returns empty if CLI false', () => {
      const option = {
        name: 'oneTwoThree',
        cli: false,
      };
      cli.getCliName(option).should.eql('');
    });
  });
  describe('.getConfig(argv)', () => {
    it('returns empty argv', () => {
      cli.getConfig(argv).should.eql({});
    });
    it('supports boolean no value', () => {
      argv.push('--recreate-closed');
      cli.getConfig(argv).should.eql({ recreateClosed: true });
      argv = argv.slice(0, -1);
    });
    it('supports boolean space true', () => {
      argv.push('--recreate-closed');
      argv.push('true');
      cli.getConfig(argv).should.eql({ recreateClosed: true });
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
      cli.getConfig(argv).should.eql({ recreateClosed: false });
    });
    it('supports boolean equals true', () => {
      argv.push('--recreate-closed=true');
      cli.getConfig(argv).should.eql({ recreateClosed: true });
    });
    it('supports boolean equals false', () => {
      argv.push('--recreate-closed=false');
      cli.getConfig(argv).should.eql({ recreateClosed: false });
    });
    it('supports list single', () => {
      argv.push('--labels=a');
      cli.getConfig(argv).should.eql({ labels: ['a'] });
    });
    it('supports list multiple', () => {
      argv.push('--labels=a,b,c');
      cli.getConfig(argv).should.eql({ labels: ['a', 'b', 'c'] });
    });
    it('supports string', () => {
      argv.push('--token=a');
      cli.getConfig(argv).should.eql({ token: 'a' });
    });
    it('supports repositories', () => {
      argv.push('foo');
      argv.push('bar');
      cli.getConfig(argv).should.eql({ repositories: ['foo', 'bar'] });
    });
    it('parses json lists correctly', () => {
      argv.push(
        `--host-rules=[{"domainName":"docker.io","hostType":"docker","username":"user","password":"password"}]`
      );
      cli.getConfig(argv).should.deep.equal({
        hostRules: [
          {
            domainName: 'docker.io',
            hostType: 'docker',
            username: 'user',
            password: 'password',
          },
        ],
      });
    });
    it('parses [] correctly as empty list of hostRules', () => {
      argv.push(`--host-rules=[]`);
      cli.getConfig(argv).should.eql({
        hostRules: [],
      });
    });
    it('parses an empty string correctly as empty list of hostRules', () => {
      argv.push(`--host-rules=`);
      cli.getConfig(argv).should.eql({
        hostRules: [],
      });
    });
    it('migrates --endpoints', () => {
      argv.push(`--endpoints=`);
      cli.getConfig(argv).should.eql({
        hostRules: [],
      });
    });
    it('parses json object correctly when empty', () => {
      argv.push(`--onboarding-config=`);
      cli.getConfig(argv).should.deep.equal({
        onboardingConfig: {},
      });
    });
    it('parses json {} object correctly', () => {
      argv.push(`--onboarding-config={}`);
      cli.getConfig(argv).should.deep.equal({
        onboardingConfig: {},
      });
    });
    it('parses json object correctly', () => {
      argv.push(`--onboarding-config={"extends": ["config:base"]}`);
      cli.getConfig(argv).should.deep.equal({
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

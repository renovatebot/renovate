const cli = require('../../lib/config/cli.js');
const getArgv = require('../_fixtures/config/argv');

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
        `--host-rules=[{"host":"docker.io","platform":"docker","username":"user","password":"password"}]`
      );
      cli.getConfig(argv).should.deep.equal({
        hostRules: [
          {
            host: 'docker.io',
            platform: 'docker',
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
  });
});

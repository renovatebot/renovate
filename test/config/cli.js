const cli = require('../../lib/config/cli.js');
let argv = require('../_fixtures/config/argv');

describe('config/cli', () => {
  describe('.getCliName(definition)', () => {
    it('generates CLI value', () => {
      const option = {
        name: 'oneTwoThree',
      };
      cli.getCliName(option).should.eql('--one-two-three');
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
      argv = argv.slice(0, -2);
    });
    it('supports boolean space false', () => {
      argv.push('--recreate-closed');
      argv.push('false');
      cli.getConfig(argv).should.eql({ recreateClosed: false });
      argv = argv.slice(0, -2);
    });
    it('supports boolean equals true', () => {
      argv.push('--recreate-closed=true');
      cli.getConfig(argv).should.eql({ recreateClosed: true });
      argv = argv.slice(0, -1);
    });
    it('supports boolean equals false', () => {
      argv.push('--recreate-closed=false');
      cli.getConfig(argv).should.eql({ recreateClosed: false });
      argv = argv.slice(0, -1);
    });
    it('supports list single', () => {
      argv.push('--labels=a');
      cli.getConfig(argv).should.eql({ labels: ['a'] });
      argv = argv.slice(0, -1);
    });
    it('supports list multiple', () => {
      argv.push('--labels=a,b,c');
      cli.getConfig(argv).should.eql({ labels: ['a', 'b', 'c'] });
      argv = argv.slice(0, -1);
    });
    it('supports string', () => {
      argv.push('--token=a');
      cli.getConfig(argv).should.eql({ token: 'a' });
      argv = argv.slice(0, -1);
    });
    it('supports repositories', () => {
      argv.push('foo');
      argv.push('bar');
      cli.getConfig(argv).should.eql({ repositories: ['foo', 'bar'] });
      argv = argv.slice(0, -2);
    });
  });
});

const handlebars = require('../../dist/helpers/handlebars');

const template = 'renovate/{{ depName }}-{{ newVersionMajor }}.x';
const upgrade = {
  depName: 'q',
  newVersionMajor: 1,
};

describe('helpers/handlebars', () => {
  describe('.transform(template, params)', () => {
    it('should work', () => {
      handlebars.transform(template, upgrade).should.eql('renovate/q-1.x');
    });
  });
});

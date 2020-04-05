import * as handlebars from 'handlebars';

handlebars.registerHelper('encodeURIComponent', encodeURIComponent);

export function compile(template: string, input: any): string {
  return handlebars.compile(template)(input);
}

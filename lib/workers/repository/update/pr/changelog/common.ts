import slugify from 'slugify';
import { regEx } from '../../../../../util/regex';

export function slugifyUrl(url: string): string {
  const r = regEx(/[:/.]+/g);
  return slugify(url.replace(r, ' '));
}

import { lang, query as q } from 'good-enough-parser';
import type { PackageVariables, ParseGradleResult } from '../types';
import { assignmentQuery, assignmentSetQuery } from './assign';
import { keywordParamsDepQuery, tripleStringCallQuery } from './function-dep';
import { pluginQuery } from './plugin-dep';
import { registryUrlQuery } from './registry';
import { depStringQuery } from './string-dep';
import {
  templateStringQuery,
  templateStringWithDataTypeQuery,
} from './template-dep';
import { GradleContext } from './types';

const query = q.alt<GradleContext>(
  assignmentQuery,
  assignmentSetQuery,
  registryUrlQuery,
  depStringQuery,
  templateStringQuery,
  templateStringWithDataTypeQuery,
  keywordParamsDepQuery,
  tripleStringCallQuery,
  pluginQuery
);

const groovy = lang.createLang('groovy');

export function parseGradle(
  content: string,
  vars: PackageVariables = {},
  packageFile = 'build.gradle'
): ParseGradleResult {
  const emptyResult = { vars, deps: [], urls: [] };
  const initialContext: GradleContext = { packageFile, result: emptyResult };
  const res = groovy.query<GradleContext>(content, query, initialContext);
  return res ? res.result : emptyResult;
}

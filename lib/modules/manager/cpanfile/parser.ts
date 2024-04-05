import { query as q } from 'good-enough-parser';
import { CpanDatasource } from '../../datasource/cpan';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as perlVersioning from '../../versioning/perl';
import type { PackageDependency } from '../types';
import { cpanfile } from './language';

interface Ctx {
  deps: PackageDependency[];

  perlVersion?: string;

  phase?: string;
  tempPhase?: string;

  depName?: string;
  currentValue?: string;
}

// requires perl, '5.36.1';
// requires 'perl' => 5.036001;
const perlVersionMatch = q
  .sym<Ctx>('requires')
  .alt(q.sym('perl'), q.str('perl'))
  .alt(q.op(','), q.op('=>'))
  .alt(
    q.num<Ctx>((ctx, { value: perlVersion }) => ({ ...ctx, perlVersion })),
    q.str<Ctx>((ctx, { value: perlVersion }) => ({ ...ctx, perlVersion })),
  )
  .op(';')
  .handler((ctx) => {
    if (ctx.perlVersion) {
      ctx.deps.push({
        depName: 'perl',
        packageName: 'Perl/perl5',
        currentValue: ctx.perlVersion,
        datasource: GithubTagsDatasource.id,
        versioning: perlVersioning.id,
        extractVersion: '^v(?<version>\\S+)',
      });
    }
    return ctx;
  });

const requirementMatch = q.sym<Ctx>(/^(?:requires|recommends|suggests)$/);

const phasedRequiresMatch = q.sym<Ctx>(
  /^(?:configure|build|test|author)_requires$/,
  (ctx, { value: phase }) => {
    ctx.tempPhase = phase.replace(/_requires/, '').replace(/author/, 'develop');
    return ctx;
  },
);

// requires 'Foo::Bar';
//
// requires 'Foo::Bar', '1.23';
// recommends 'Foo::Bar', '1.23';
// suggests 'Foo::Bar', '1.23';
//
// configure_requires 'Foo::Bar' => 1.023;
// build_requires 'Foo::Bar' => 1.023;
// test_requires 'Foo::Bar' => 1.023;
// author_requires 'Foo::Bar' => 1.023;
const moduleMatch = q
  .alt(requirementMatch, phasedRequiresMatch)
  .str((ctx, { value: depName }) => ({ ...ctx, depName }))
  .opt(
    q.alt<Ctx>(q.op(','), q.op('=>')).alt(
      q.num<Ctx>((ctx, { value: currentValue }) => ({ ...ctx, currentValue })),
      q.str<Ctx>((ctx, { value }) => {
        const currentValue = value.replace(/^(?:\s*(?:==|>=|>))?\s*v?/, '');
        return { ...ctx, currentValue };
      }),
    ),
  )
  .op(';')
  .handler((ctx) => {
    const { phase, tempPhase, depName, currentValue } = ctx;

    delete ctx.tempPhase;
    delete ctx.depName;
    delete ctx.currentValue;

    if (depName) {
      const dep: PackageDependency = {
        depName,
      };
      if (currentValue) {
        dep.currentValue = currentValue;
      } else {
        dep.skipReason = 'unspecified-version';
      }
      if (phase) {
        dep.depType = phase;
      } else if (tempPhase) {
        dep.depType = tempPhase;
      }

      dep.datasource = CpanDatasource.id;
      ctx.deps.push(dep);
    }

    return ctx;
  });

const phaseRegex = /^(?:configure|build|test|runtime|develop)/;

const phaseMatch = q.alt<Ctx>(
  q.sym(phaseRegex, (ctx, { value: phase }) => ({ ...ctx, phase })),
  q.str(phaseRegex, (ctx, { value: phase }) => ({ ...ctx, phase })),
);

// on 'configure' => sub {
// on build => sub {
// on 'test' => sub {
// on runtime => sub {
// on 'develop' => sub {
const onMatch = q
  .sym<Ctx>('on')
  .join(phaseMatch)
  .op('=>')
  .sym('sub')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    search: moduleMatch,
  })
  .handler((ctx) => {
    delete ctx.phase;
    return ctx;
  });

const query = q.tree<Ctx>({
  type: 'root-tree',
  maxDepth: 4,
  search: q.alt<Ctx>(perlVersionMatch, moduleMatch, onMatch),
});

export function parse(
  content: string,
): Pick<Ctx, 'deps' | 'perlVersion'> | null {
  return cpanfile.query(content, query, {
    deps: [],
  });
}

# Ruby versioning

## Documentation and URLs

https://guides.rubygems.org/patterns/
https://bundler.io/v1.5/gemfile.html
https://www.devalot.com/articles/2012/04/gem-versions.html

## What type of versioning is used?

> The RubyGems team urges gem developers to follow the Semantic Versioning standard for their gem’s versions.

## Are ranges supported? How?

Range syntax is similar to npm's but not identical. The main difference is the use of "pessimistic" greater than or equals: `~>`

## Range Strategy support

Ruby versioning should support all range strategies - pin, replace, bump, extend.

## Implementation plan/status

- [x] Exact version support
- [x] Range support

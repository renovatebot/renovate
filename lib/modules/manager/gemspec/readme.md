The `gemspec` manager extracts Ruby runtime and development dependencies declared with `add_dependency`, `add_runtime_dependency`, and `add_development_dependency` in `*.gemspec` files.

When a sibling `Gemfile.lock` exists, it is refreshed after a constraint change using Bundler.

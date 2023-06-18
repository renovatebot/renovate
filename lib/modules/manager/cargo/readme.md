Extracts dependencies from `Cargo.toml` files, and also updates `Cargo.lock` files too if found.

When using the default rangeStrategy=auto:

- If a "less than" instruction is found (e.g. `<2`) then `rangeStrategy=widen` will be selected,
- Otherwise, `rangeStrategy=bump` will be selected.

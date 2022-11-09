Keeps the [asdf](https://asdf-vm.com/manage/configuration.html#tool-versions) `.tool-versions` file updated.

Because `asdf` supports versioning for many different tools, specific tool support must be added one-by-one.
The following tools are currently supported:

- [awscli](https://github.com/MetricMike/asdf-awscli)
- [bun](https://github.com/cometkim/asdf-bun)
- [cargo-make](https://github.com/kachick/asdf-cargo-make)
- [clojure](https://github.com/asdf-community/asdf-clojure)
- [crystal](https://github.com/asdf-community/asdf-crystal)
- [deno](https://github.com/asdf-community/asdf-deno)
- [direnv](https://github.com/asdf-community/asdf-direnv)
- [dprint](https://github.com/asdf-community/asdf-dprint)
- [elixir](https://github.com/asdf-vm/asdf-elixir)
- [elm](https://github.com/asdf-community/asdf-elm)
- [erlang](https://github.com/asdf-vm/asdf-erlang)
- [gauche](https://github.com/sakuro/asdf-gauche)
- [golang](https://github.com/kennyp/asdf-golang)
- [haskell](https://github.com/asdf-community/asdf-haskell)
- [helm](https://github.com/Antiarchitect/asdf-helm)
- [helmfile](https://github.com/feniix/asdf-helmfile)
- [hugo](https://github.com/NeoHsu/asdf-hugo)
- [idris](https://github.com/asdf-community/asdf-idris)
- [java](https://github.com/halcyon/asdf-java)
- [julia](https://github.com/rkyleg/asdf-julia)
- [just](https://github.com/olofvndrhr/asdf-just)
- [kotlin](https://github.com/asdf-community/asdf-kotlin)
- [kustomize](https://github.com/Banno/asdf-kustomize)
- [lua](https://github.com/Stratus3D/asdf-lua)
- [nim](https://github.com/asdf-community/asdf-nim)
- [nodejs](https://github.com/asdf-vm/asdf-nodejs)
- [ocaml](https://github.com/asdf-community/asdf-ocaml)
- [perl](https://github.com/ouest/asdf-perl)
- [php](https://github.com/asdf-community/asdf-php)
- [python](https://github.com/danhper/asdf-python)
- [ruby](https://github.com/asdf-vm/asdf-ruby)
- [rust](https://github.com/code-lever/asdf-rust)
- [scala](https://github.com/asdf-community/asdf-scala)
- [shellcheck](https://github.com/luizm/asdf-shellcheck)
- [shfmt](https://github.com/luizm/asdf-shfmt)
- [terraform](https://github.com/asdf-community/asdf-hashicorp)
- [trivy](https://github.com/zufardhiyaulhaq/asdf-trivy)
- [zig](https://github.com/cheetah/asdf-zig)

<!-- prettier-ignore -->
!!! note
    Only the first version entry for each supported tool is managed, this is because `.tool-versions` supports fallback versions.

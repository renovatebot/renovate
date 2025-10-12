{
  description = "Renovate - Automated dependency updates";

  inputs = {
    nixpkgs.url = "https://flakehub.com/f/JHOFER-Cloud/NixOS-nixpkgs/0.1.tar.gz";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = nixpkgs.legacyPackages.${system};

      renovate = pkgs.stdenv.mkDerivation (finalAttrs: {
        pname = "renovate";
        version = "unstable";

        src = ./.;

        nativeBuildInputs = with pkgs;
          [
            makeWrapper
            nodejs_22
            pnpm_10.configHook
            python3
            yq-go
          ]
          ++ lib.optionals stdenv.hostPlatform.isDarwin [
            xcbuild
          ];

        pnpmDeps = pkgs.pnpm_10.fetchDeps {
          inherit (finalAttrs) pname version src;
          fetcherVersion = 2;
          hash = "sha256-yIhKst+1a+n0oU204DEe1ZDEfrg0UOWihIC7nAWNEUA=";
        };

        env.COREPACK_ENABLE_STRICT = 0;

        buildPhase = ''
          runHook preBuild

          # relax nodejs version
          yq '.engines.node = "${pkgs.nodejs_22.version}"' -i package.json

          pnpm build
          find -name 'node_modules' -type d -exec rm -rf {} \; || true
          pnpm install --offline --prod --ignore-scripts

          # The optional dependency re2 is not built by pnpm and needs to be built manually.
          if [[ -d node_modules/.pnpm/re2*/node_modules/re2 ]]; then
            echo "Building re2 native module..."
            pushd node_modules/.pnpm/re2*/node_modules/re2

            mkdir -p $HOME/.node-gyp/${pkgs.nodejs_22.version}
            echo 9 > $HOME/.node-gyp/${pkgs.nodejs_22.version}/installVersion
            ln -sfv ${pkgs.nodejs_22}/include $HOME/.node-gyp/${pkgs.nodejs_22.version}
            export npm_config_nodedir=${pkgs.nodejs_22}

            # Try to rebuild re2
            ${pkgs.pnpm_10}/bin/pnpm rebuild || echo "re2 rebuild failed, will fallback to RegExp"

            popd
          fi

          runHook postBuild
        '';

        installPhase = ''
          runHook preInstall

          mkdir -p $out/{bin,lib/node_modules/renovate}
          cp -r dist node_modules package.json $out/lib/node_modules/renovate

          # Copy schema if it exists
          if [[ -e renovate-schema.json ]]; then
            cp renovate-schema.json $out/lib/node_modules/renovate/
          fi

          makeWrapper "${pkgs.lib.getExe pkgs.nodejs_22}" "$out/bin/renovate" \
            --add-flags "$out/lib/node_modules/renovate/dist/renovate.js"
          makeWrapper "${pkgs.lib.getExe pkgs.nodejs_22}" "$out/bin/renovate-config-validator" \
            --add-flags "$out/lib/node_modules/renovate/dist/config-validator.js"

          runHook postInstall
        '';

        meta = with pkgs.lib; {
          description = "Automated dependency updates. Flexible so you don't need to be.";
          homepage = "https://renovatebot.com/";
          changelog = "https://github.com/renovatebot/renovate/releases";
          license = licenses.agpl3Only;
          maintainers = with maintainers; [];
          mainProgram = "renovate";
        };
      });
    in {
      packages = {
        default = renovate;
        renovate = renovate;
      };

      apps = {
        default = flake-utils.lib.mkApp {
          drv = renovate;
          name = "renovate";
        };
        renovate = flake-utils.lib.mkApp {
          drv = renovate;
          name = "renovate";
        };
        renovate-config-validator = flake-utils.lib.mkApp {
          drv = renovate;
          name = "renovate-config-validator";
        };
      };

      # Development shell
      devShells.default = pkgs.mkShell {
        buildInputs = with pkgs; [
          nodejs_22
          pnpm
          git
          gh
          jq
          tsx
        ];
      };
    });
}

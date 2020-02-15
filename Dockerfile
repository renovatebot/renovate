FROM amd64/node:10.19.0@sha256:06e80d0a45ea264fa69296cce992bc6f9c6956ff18f314c6211ba5b0db34e468 AS tsbuild

COPY package.json .
COPY yarn.lock .
RUN yarn install --frozen-lockfile

COPY lib lib
COPY tsconfig.json tsconfig.json
COPY tsconfig.app.json tsconfig.app.json

RUN yarn build:docker


FROM amd64/ubuntu:18.04@sha256:bc025862c3e8ec4a8754ea4756e33da6c41cba38330d7e324abd25c8e0b93300

LABEL maintainer="Rhys Arkins <rhys@arkins.net>"
LABEL name="renovate"
LABEL org.opencontainers.image.source="https://github.com/renovatebot/renovate"

ENV APP_ROOT=/usr/src/app
WORKDIR ${APP_ROOT}

ENV DEBIAN_FRONTEND noninteractive
ENV LC_ALL C.UTF-8
ENV LANG C.UTF-8

RUN apt-get update && apt-get install -y gpg curl wget unzip xz-utils git openssh-client bsdtar build-essential && \
    rm -rf /var/lib/apt/lists/*

## Gradle

RUN apt-get update && apt-get install -y --no-install-recommends openjdk-11-jre-headless gradle && \
    rm -rf /var/lib/apt/lists/*

## Node.js

# START copy Node.js from https://github.com/nodejs/docker-node/blob/master/10/jessie/Dockerfile

ENV NODE_VERSION 10.16.0

RUN ARCH= && dpkgArch="$(dpkg --print-architecture)" \
  && case "${dpkgArch##*-}" in \
  amd64) ARCH='x64';; \
  ppc64el) ARCH='ppc64le';; \
  s390x) ARCH='s390x';; \
  arm64) ARCH='arm64';; \
  armhf) ARCH='armv7l';; \
  i386) ARCH='x86';; \
  *) echo "unsupported architecture"; exit 1 ;; \
  esac \
  # gpg keys listed at https://github.com/nodejs/node#release-keys
  && set -ex \
  && for key in \
  94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
  FD3A5288F042B6850C66B31F09FE44734EB7990E \
  71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
  DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
  C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
  B9AE9905FFD7803F25714661B63B535A4C206CA9 \
  77984A986EBC2AA786BC0F66B01FBB92821C587A \
  8FCCA13FEF1D0C2E91008E09770F7A9A5AE15600 \
  4ED778F539E3634C779C87C6D7062848A1AB005C \
  A48C2BEE680E841632CD4E44F07496B3EB3C1762 \
  B9E2F5981AA6E0CD28160D9FF13993A75599653C \
  ; do \
  gpg --batch --keyserver hkp://p80.pool.sks-keyservers.net:80 --recv-keys "$key" || \
  gpg --batch --keyserver hkp://ipv4.pool.sks-keyservers.net --recv-keys "$key" || \
  gpg --batch --keyserver hkp://pgp.mit.edu:80 --recv-keys "$key" ; \
  done \
  && curl -fsSLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$ARCH.tar.xz" \
  && curl -fsSLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
  && gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc \
  && grep " node-v$NODE_VERSION-linux-$ARCH.tar.xz\$" SHASUMS256.txt | sha256sum -c - \
  && bsdtar -xJf "node-v$NODE_VERSION-linux-$ARCH.tar.xz" -C /usr/local --strip-components=1 --no-same-owner \
  && rm "node-v$NODE_VERSION-linux-$ARCH.tar.xz" SHASUMS256.txt.asc SHASUMS256.txt \
  && ln -s /usr/local/bin/node /usr/local/bin/nodejs

## END copy Node.js

# Erlang

RUN cd /tmp && \
    curl https://packages.erlang-solutions.com/erlang-solutions_1.0_all.deb -o erlang-solutions_1.0_all.deb && \
    dpkg -i erlang-solutions_1.0_all.deb && \
    rm -f erlang-solutions_1.0_all.deb

ENV ERLANG_VERSION=22.0.2-1

RUN apt-get update && \
    apt-cache policy esl-erlang && \
    apt-get install -y esl-erlang=1:$ERLANG_VERSION && \
    rm -rf /var/lib/apt/lists/*

# Elixir

ENV ELIXIR_VERSION 1.8.2

RUN curl -L https://github.com/elixir-lang/elixir/releases/download/v${ELIXIR_VERSION}/Precompiled.zip -o Precompiled.zip && \
    mkdir -p /opt/elixir-${ELIXIR_VERSION}/ && \
    unzip Precompiled.zip -d /opt/elixir-${ELIXIR_VERSION}/ && \
    rm Precompiled.zip

ENV PATH $PATH:/opt/elixir-${ELIXIR_VERSION}/bin

# PHP Composer

RUN apt-get update && apt-get install -y php-cli php-mbstring && \
    rm -rf /var/lib/apt/lists/*

ENV COMPOSER_VERSION=1.9.3

RUN php -r "copy('https://github.com/composer/composer/releases/download/$COMPOSER_VERSION/composer.phar', '/usr/local/bin/composer');"

RUN chmod +x /usr/local/bin/composer

# Go Modules

RUN apt-get update && apt-get install -y bzr mercurial && \
    rm -rf /var/lib/apt/lists/*

ENV GOLANG_VERSION 1.13.4

# Disable GOPROXY and GOSUMDB until we offer a solid solution to configure
# private repositories.
ENV GOPROXY=direct GOSUMDB=off

RUN wget -q -O go.tgz "https://golang.org/dl/go${GOLANG_VERSION}.linux-amd64.tar.gz" && \
  tar -C /usr/local -xzf go.tgz && \
  rm go.tgz && \
  export PATH="/usr/local/go/bin:$PATH"

ENV GOPATH /go
ENV PATH $GOPATH/bin:/usr/local/go/bin:$PATH

RUN mkdir -p "$GOPATH/src" "$GOPATH/bin" && chmod -R 777 "$GOPATH"

ENV CGO_ENABLED=0

# Python

RUN apt-get update && apt-get install -y python3.8-dev python3.8-venv python3-distutils && \
    rm -rf /var/lib/apt/lists/*

RUN rm -fr /usr/bin/python3 && ln /usr/bin/python3.8 /usr/bin/python3
RUN rm -rf /usr/bin/python && ln /usr/bin/python3.8 /usr/bin/python

# Pip

RUN curl --silent https://bootstrap.pypa.io/get-pip.py | python

# Set up ubuntu user and home directory with access to users in the root group (0)

ENV HOME=/home/ubuntu
RUN groupadd --gid 1000 ubuntu && \
  useradd --uid 1000 --gid ubuntu --groups 0 --shell /bin/bash --home-dir ${HOME} --create-home ubuntu


RUN chown -R ubuntu:0 ${APP_ROOT} ${HOME} && \
  chmod -R g=u ${APP_ROOT} ${HOME}

# Docker client and group

RUN groupadd -g 999 docker
RUN usermod -aG docker ubuntu

ENV DOCKER_VERSION=19.03.1

RUN curl -fsSLO https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz \
  && tar xzvf docker-${DOCKER_VERSION}.tgz --strip 1 \
  -C /usr/local/bin docker/docker \
  && rm docker-${DOCKER_VERSION}.tgz

USER ubuntu

# Cargo

ENV RUST_BACKTRACE=1 \
  PATH=${HOME}/.cargo/bin:$PATH

ENV RUST_VERSION=1.36.0

RUN set -ex ;\
  curl https://sh.rustup.rs -sSf | sh -s -- --no-modify-path --profile minimal --default-toolchain ${RUST_VERSION} -y

# Mix and Rebar

RUN mix local.hex --force
RUN mix local.rebar --force

# Pipenv

ENV PATH="${HOME}/.local/bin:$PATH"

RUN pip install --user pipenv

# Poetry

ENV POETRY_VERSION=1.0.0

RUN curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python - --version ${POETRY_VERSION}

ENV PATH="${HOME}/.poetry/bin:$PATH"
RUN poetry config virtualenvs.in-project false

# npm

ENV NPM_VERSION=6.10.2

RUN npm install -g npm@$NPM_VERSION

# Yarn

ENV YARN_VERSION=1.19.1

RUN curl -o- -L https://yarnpkg.com/install.sh | bash -s -- --version ${YARN_VERSION}

ENV PATH="${HOME}/.yarn/bin:${HOME}/.config/yarn/global/node_modules/.bin:$PATH"

COPY package.json .
COPY yarn.lock .
RUN yarn install --production --frozen-lockfile && yarn cache clean
RUN rm -f yarn.lock
COPY --from=tsbuild dist dist
COPY bin bin
COPY data data


# Numeric user ID for the ubuntu user. Used to indicate a non-root user to OpenShift
USER 1000

ENTRYPOINT ["node", "/usr/src/app/dist/renovate.js"]
CMD []

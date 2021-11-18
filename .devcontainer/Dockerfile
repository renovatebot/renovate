FROM containerbase/node:v14.18.1@sha256:b720748f7a35570e402a8741f37a5bd54ad485dd6b4aeaff04027ad761b1306d

USER 0
RUN install-tool ruby 3.0.1
USER 1000
# renovate: datasource=npm
RUN install-tool yarn 1.22.17

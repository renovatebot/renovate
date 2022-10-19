#  syntax=docker/dockerfile:1
 # EsCaPe=`
 ARG `
	# multi-line arg
   ALPINE_VERSION=alpine:3.15.4

FROM `
${ALPINE_VERSION} as stage1

ARG   `
  `
 # multi-line arg
 # and multi-line comment
   nginx_version="nginx:18.04@sha256:abcdef"

FROM $nginx_version as stage2

	FROM 	`
 	  `
   image5 `
	#comment5
	as name3

	COPY 	`
 	  `
   --from=image12 a `
	#comment5
	b

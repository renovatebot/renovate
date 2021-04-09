# different FROM syntaxes
 FROM  image1 as		name1

FROM image2:1.0.0@sha256:abcdef \
	as name2

# FROM image3

FROM\
    --platform=linux \
	# comment1
	 image4

	FROM 	\
 	  \
   image5 \
	#comment5
	as name3

# different COPY --from syntaxes
COPY --from=image6 /path/1 /path/2

 COPY \
	# comment1
	--from=image7:1.0.0@sha256:abcdef \
	/path/1 \
	/path/2

# COPY --from=image8

COPY --chown=root --from=image11 / ./

	COPY 	\
 	  \
   --from=image12 a \
	#comment5
	b

COPY	--from=image13 --chown=root: a b

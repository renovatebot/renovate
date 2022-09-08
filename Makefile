.PHONY: extract new

extract:
	xgettext -d github \
             --output-dir=./locales/pot \
	         --language=JavaScript \
             --package-name=renovate-platform \
             --msgid-bugs-address=wadexing@gmail.com \
			 --keyword=__ \
			 lib/modules/platform/github/index.ts && \
    gsed -i 's/CHARSET/UTF-8/' ./locales/pot/github.po

	xgettext -d onboarding \
             --output-dir=./locales/pot \
	         --language=JavaScript \
             --package-name=renovate-platform \
             --msgid-bugs-address=wadexing@gmail.com \
			 --keyword=__ \
			 lib/workers/repository/onboarding/pr/index.ts && \
	gsed -i 's/CHARSET/UTF-8/'  ./locales/pot/onboarding.po

new:
	msginit --input=./locales/pot/github.po \
            --output=./locales/zh-CN/github.po \
            --locale=zh-CN

	msginit --input=./locales/pot/onboarding.po \
            --output=./locales/zh-CN/onboarding.po \
            --locale=zh-CN

update:
	msgmerge --update --lang=zh-CN locales/cn/github.po locales/pot/github.po

export:
	node ./node_modules/.bin/po2json -f mf ./locales/zh-CN/github.po ./locales/zh-CN/github.json
	node ./node_modules/.bin/po2json -f mf ./locales/ja/github.po ./locales/ja/github.json
	node ./node_modules/.bin/po2json -f mf ./locales/zh-CN/onboarding.po ./locales/zh-CN/onboarding.json

.PHONY: i18n/sources.txt i18n/messages.pot

i18n/sources.txt:
	@grep --files-with-match --recursive --extended-regexp "gettext\(" lib > i18n/sources.txt

i18n/messages.pot:
	xgettext --files-from=i18n/sources.txt \
		     --output=i18n/messages.pot \
			 --join-existing \
			 --language=JavaScript \
			 --package-name=renovate-platform

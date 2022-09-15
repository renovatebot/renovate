.PHONY: i18n/sources.txt i18n/messages.pot

i18n/sources.txt:
	@grep \
		--files-with-match \
		--recursive \
		--include \*.ts \
		--extended-regexp "\.(gettext|dgettext|ngettext|dngettext|pgettext|dpgettext|npgettext|dnpgettext)\(" lib | sort > i18n/sources.txt

i18n/messages.pot:
	@xgettext \
		--files-from=i18n/sources.txt \
		--output=i18n/messages.pot \
		--sort-by-file \
		--join-existing \
		--language=JavaScript \
		--package-name=renovate-platform

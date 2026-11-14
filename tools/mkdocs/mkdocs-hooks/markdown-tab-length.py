import markdown

_orig_init = markdown.Markdown.__init__


def _patched_init(self, **kwargs):
    kwargs.setdefault('tab_length', 2)
    _orig_init(self, **kwargs)


markdown.Markdown.__init__ = _patched_init

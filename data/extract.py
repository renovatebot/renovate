import sys
import json
import os
from os.path import basename

if sys.version_info[:2] >= (3, 3):
  from importlib.machinery import SourceFileLoader
  def load_source(name, path):
    if not os.path.exists(path):
      return {}
    return vars(SourceFileLoader('mod', path).load_module())
else:
  import imp
  def load_source(name, path):
    if not os.path.exists(path):
      return {}
    return vars(imp.load_source('mod', path))

try:
  import setuptools
except ImportError:
  class setuptools:
    def setup():
      pass

import distutils.core

try:
  from unittest import mock
except ImportError:
  # for python3.3+
  import mock

@mock.patch.object(setuptools, 'setup')
@mock.patch.object(distutils.core, 'setup')
def invoke(mock1, mock2):
  # Inserting the parent directory of the target setup.py in Python import path:
  sys.path.append(os.getcwd())
  # This is setup.py which calls setuptools.setup
  load_source('_target_setup_', basename(sys.argv[-1]))
  # called arguments are in `mock_setup.call_args`
  call_args = mock1.call_args or mock2.call_args

  if call_args:
    # get only install_requires and extras_require arguments
    kwargs = {
      k: v for k, v in call_args[1].items()
      if k in ('install_requires', 'extras_require')
    }
    # save report.json
    with open('renovate-pip_setup-report.json', 'w', encoding='utf-8') as f:
      json.dump(kwargs, f, ensure_ascii=False, indent=2)

invoke()

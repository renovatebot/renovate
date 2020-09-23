import sys
import json
import os
import distutils.core
from os.path import dirname, realpath

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

try:
  from unittest import mock
except ImportError:
  # for python3.3+
  import mock

@mock.patch.object(setuptools, 'setup')
@mock.patch.object(distutils.core, 'setup')
def invoke(mock1, mock2):
  # Inserting the parent directory of the target setup.py in Python import path:
  sys.path.append(dirname(realpath(sys.argv[-1])))
  # This is setup.py which calls setuptools.setup
  load_source('_target_setup_', sys.argv[-1])
  # called arguments are in `mock_setup.call_args`
  call_args = mock1.call_args or mock2.call_args
  args, kwargs = call_args
  with open('renovate-pip_setup-report.json', 'w', encoding='utf-8') as f:
    json.dump(kwargs, f, ensure_ascii=False, indent=2)

invoke()

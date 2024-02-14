from setuptools import setup, find_packages

setup(
    name='MyPackageName',
    version='1.0.0',
    url='https://github.com/example.git',
    author='Jan Kowalski',
    author_email='jan@example.com',
    description='Description of my package',
    packages=find_packages(),
    install_requires=['numpy >= 1.26.0'],
)

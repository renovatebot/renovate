
try:
    from setuptools import setup
except ImportError:
    from distutils.core import setup

setup(
    author='Simon Davy',
    author_email='simon.davy@canonical.com',
    classifiers=[
        'License :: OSI Approved :: Apache Software License',
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'Natural Language :: English',
        'Topic :: Internet :: WWW/HTTP :: WSGI',
        'Topic :: Internet :: WWW/HTTP :: WSGI :: Middleware',
        'Topic :: System :: Logging',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: Implementation :: CPython',
    ],
    description='A common WSGI stack',
    entry_points=dict(
        console_scripts=[
            'talisker=talisker:run_gunicorn',
            'talisker.run=talisker:run',
            'talisker.gunicorn=talisker:run_gunicorn',
            'talisker.gunicorn.eventlet=talisker:run_gunicorn_eventlet',
            'talisker.gunicorn.gevent=talisker:run_gunicorn_gevent',
            'talisker.celery=talisker:run_celery',
        ],
    ),
    extras_require=dict(
        celery=[
            'celery>=3.1.13.0,<5.0',
        ],
        dev=[
            'logging_tree>=1.7',
            'pygments>=2.2',
            'psutil>=5.0',
            'objgraph>=3.0',
        ],
        django=[
            'django>=1.11.23,<2.0',
        ],
        flask=[
            'flask>=0.11,<2.0',
            'blinker>=1.4,<2.0',
        ],
        pg=[
            'sqlparse',
            'psycopg2',
        ],
        prometheus=[
            'prometheus-client>=0.2.0,<0.5.0' + ',!=0.4.0,!=0.4.1',
        ],
    ),
    include_package_data=True,
    install_requires=['gunicorn>=19.7.0,<20.0', 'Werkzeug>=0.15.3,<0.16', 'pycryptodome==3.7.3','statsd>=3.2.1,<4.0', 'requests>=2.10.0,<3.0', 'raven>=5.27.1,<7.0','future>=0.15.2,<0.17',],
    keywords=[
        'talisker',
    ],
    name='talisker',
    package_data=dict(
        talisker=[
            'logstash/*',
        ],
    ),
    package_dir=dict(
        talisker='talisker',
    ),
    packages=[
        'talisker',
    ],
    test_suite='tests',
    url='https://github.com/canonical-ols/talisker',
    version='0.9.16',
    zip_safe=False,
)

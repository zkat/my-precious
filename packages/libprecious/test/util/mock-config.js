'use strict'

const hasUnicode = require('has-unicode')
const path = require('path')
const PreciousConfig = require('../../lib/config/npm-config.js')

module.exports = mockConfig
function mockConfig (testDir, opts) {
  if (!testDir) { throw new Error('testDir is required') }
  opts = opts || {}
  return PreciousConfig.fromObject(Object.assign({
    access: null,
    'allow-same-version': false,
    'always-auth': false,
    also: null,
    'auth-type': 'legacy',

    'bin-links': true,
    browser: null,

    ca: null,
    cafile: null,

    cache: path.join(testDir, '.npm-cache'),

    'cache-lock-stale': 60000,
    'cache-lock-retries': 10,
    'cache-lock-wait': 10000,

    'cache-max': Infinity,
    'cache-min': 10,

    cert: null,

    cidr: null,

    color: true,
    depth: Infinity,
    description: true,
    dev: false,
    'dry-run': false,
    'engine-strict': false,
    force: false,

    'fetch-retries': 2,
    'fetch-retry-factor': 10,
    'fetch-retry-mintimeout': 10000,
    'fetch-retry-maxtimeout': 60000,

    git: 'git',
    'git-tag-version': true,
    'commit-hooks': true,

    global: false,
    group: process.platform === 'win32'
      ? 0
      : process.env.SUDO_GID || (process.getgid && process.getgid()),
    heading: 'npm',
    'if-present': false,
    'ignore-prepublish': false,
    'ignore-scripts': false,
    json: false,
    key: null,
    'legacy-bundling': false,
    link: false,
    'local-address': undefined,
    loglevel: process.env.LOGLEVEL || 'silent',
    logstream: process.stderr,
    'logs-max': 10,
    long: false,
    maxsockets: 50,
    message: '%s',
    'metrics-registry': null,
    'node-options': null,
    'node-version': process.version,
    offline: false,
    'onload-script': false,
    only: null,
    optional: true,
    otp: null,
    'package-lock': true,
    'package-lock-only': false,
    parseable: false,
    'prefer-offline': false,
    'prefer-online': false,
    prefix: path.join(testDir, '_global'),
    production: process.env.NODE_ENV === 'production',
    progress: !process.env.TRAVIS && !process.env.CI,
    proxy: null,
    'https-proxy': null,
    'user-agent': 'npm/{npm-version} ' +
                    'node/{node-version} ' +
                    '{platform} ' +
                    '{arch}',
    'read-only': false,
    'rebuild-bundle': true,
    registry: 'https://registry.npmjs.org/',
    rollback: true,
    save: true,
    'save-bundle': false,
    'save-dev': false,
    'save-exact': false,
    'save-optional': false,
    'save-prefix': '^',
    'save-prod': false,
    scope: '',
    'script-shell': null,
    'scripts-prepend-node-path': 'warn-only',
    shrinkwrap: true,
    'sign-git-tag': false,
    'sso-poll-frequency': 500,
    'sso-type': 'oauth',
    'strict-ssl': true,
    tag: 'latest',
    'tag-version-prefix': 'v',
    timing: false,
    tmp: path.join(testDir, '_tmp'),
    unicode: hasUnicode(),
    'unsafe-perm': process.platform === 'win32' ||
                     process.platform === 'cygwin' ||
                     !(process.getuid && process.setuid &&
                       process.getgid && process.setgid) ||
                     process.getuid() !== 0,
    usage: false,
    user: process.platform === 'win32' ? 0 : 'nobody',
    userconfig: path.join(testDir, '_user_npmrc'),
    umask: process.umask(),
    version: false,
    versions: false,
    viewer: process.platform === 'win32' ? 'browser' : 'man'

  }, opts || {}))
}

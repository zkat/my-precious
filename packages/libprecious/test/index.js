'use strict'
// This needs to be added to access our git binstub
const path = require('path')
process.env.PATH = path.resolve(__dirname, 'bin-stubs') + ':' + process.env.PATH

const BB = require('bluebird')

const fs = BB.promisifyAll(require('fs'))
const mockConfig = require('./util/mock-config.js')
const mockTar = require('./util/mock-tarball.js')
const tnock = require('./util/tnock.js')
const npmlog = require('npmlog')
const ssri = require('ssri')
const Tacks = require('tacks')
const test = require('tap').test

const MyPrecious = require('../index.js')
const testDir = require('./util/test-dir.js')(__filename)

const Dir = Tacks.Dir
const File = Tacks.File

const REGISTRY = 'https://my.mock.registry/'

test('it works', t => {
  return mockTar({
    // This makes the tarball for `bar` itself, to be hosted by tnock
    'package.json': JSON.stringify({
      name: 'bar',
      version: '1.0.1'
    }),
    'index.js': 'hi'
  }, {gzip: true})
    .then(tgzData => {
      const integrity = ssri.fromData(tgzData).toString()
      const fixture = new Tacks(Dir({
        'package.json': File({
          name: 'foo',
          version: '1.2.3',
          dependencies: {
            bar: '^1.0.0'
          }
        }),
        'package-lock.json': File({
          name: 'foo',
          lockfileVersion: 1,
          requires: true,
          dependencies: {
            bar: {
              version: '1.0.1',
              resolved: REGISTRY + 'bar/-/bar-1.0.1.tgz',
              integrity
            }
          }
        })
      }))
      fixture.create(testDir)
      const config = mockConfig(testDir, {registry: REGISTRY})
      tnock(t, REGISTRY).get('/bar/-/bar-1.0.1.tgz').reply(200, tgzData)
      const archivedResolved = `file:archived-packages/bar-1.0.1-${ssri.parse(integrity).hexDigest().slice(0, 9)}.tar`
      return new MyPrecious({log: npmlog, config})
        .run()
        .then(() => fs.readFileAsync('package-lock.json', 'utf8'))
        .then(JSON.parse)
        .then(pkgLock => {
          t.equal(
            pkgLock.dependencies.bar.resolved,
            archivedResolved,
            'resolved field updated in package-lock'
          )
          return fs.readFileAsync(archivedResolved.substr(5))
            .then(tarData => {
              const newSri = pkgLock.dependencies.bar.integrity
              t.ok(tarData.length > tgzData.length, 'tarball is gunzipped')
              t.ok(
                ssri.checkData(tarData, newSri),
                'archived tarball passes integrity check'
              )
              t.ok(
                ssri.checkData(tgzData, newSri),
                'updated integrity field still matches old tgzData'
              )
              t.notOk(
                ssri.checkData('blah', newSri),
                'updated integrity field is actually checking data at all'
              )
            })
        })
    })
})

test('it archives devdeps by default', t => {
  return mockTar({
    // This makes the tarball for `bar` itself, to be hosted by tnock
    'package.json': JSON.stringify({
      name: 'bar',
      version: '1.0.1'
    }),
    'index.js': 'hi'
  }, {gzip: true})
    .then(tgzData => {
      const integrity = ssri.fromData(tgzData).toString()
      const fixture = new Tacks(Dir({
        'package.json': File({
          name: 'foo',
          version: '1.2.3',
          devDependencies: {
            bar: '^1.0.0'
          }
        }),
        'package-lock.json': File({
          name: 'foo',
          lockfileVersion: 1,
          requires: true,
          dependencies: {
            bar: {
              version: '1.0.1',
              resolved: REGISTRY + 'bar/-/bar-1.0.1.tgz',
              integrity,
              dev: true
            }
          }
        })
      }))
      fixture.create(testDir)
      const config = mockConfig(testDir, {registry: REGISTRY})
      tnock(t, REGISTRY).get('/bar/-/bar-1.0.1.tgz').reply(200, tgzData)
      const archivedResolved = `file:archived-packages/bar-1.0.1-${ssri.parse(integrity).hexDigest().slice(0, 9)}.tar`
      return new MyPrecious({log: npmlog, config})
        .run()
        .then(() => fs.readFileAsync('package-lock.json', 'utf8'))
        .then(JSON.parse)
        .then(pkgLock => {
          t.equal(
            pkgLock.dependencies.bar.resolved,
            archivedResolved,
            'resolved field updated in package-lock'
          )
          return fs.readFileAsync(archivedResolved.substr(5))
            .then(tarData => {
              const newSri = pkgLock.dependencies.bar.integrity
              t.ok(tarData.length > tgzData.length, 'tarball is gunzipped')
              t.ok(
                ssri.checkData(tarData, newSri),
                'archived tarball passes integrity check'
              )
              t.ok(
                ssri.checkData(tgzData, newSri),
                'updated integrity field still matches old tgzData'
              )
              t.notOk(
                ssri.checkData('blah', newSri),
                'updated integrity field is actually checking data at all'
              )
            })
        })
    })
})

test('it does not archive devdeps with `only=production` config', t => {
  return mockTar({
    // This makes the tarball for `bar` itself, to be hosted by tnock
    'package.json': JSON.stringify({
      name: 'bar',
      version: '1.0.1'
    }),
    'index.js': 'hi'
  }, {gzip: true})
    .then(tgzData => {
      const integrity = ssri.fromData(tgzData).toString()
      const fixture = new Tacks(Dir({
        'package.json': File({
          name: 'foo',
          version: '1.2.3',
          devDependencies: {
            bar: '^1.0.0'
          }
        }),
        'package-lock.json': File({
          name: 'foo',
          lockfileVersion: 1,
          requires: true,
          dependencies: {
            bar: {
              version: '1.0.1',
              resolved: REGISTRY + 'bar/-/bar-1.0.1.tgz',
              integrity,
              dev: true
            }
          }
        })
      }))
      fixture.create(testDir)
      const config = mockConfig(testDir, {registry: REGISTRY, only: 'production'})
      return new MyPrecious({log: npmlog, config})
        .run()
        .then(() => fs.readFileAsync('package-lock.json', 'utf8'))
        .then(JSON.parse)
        .then(pkgLock => {
          t.equal(
            pkgLock.dependencies.bar.resolved,
            REGISTRY + 'bar/-/bar-1.0.1.tgz',
            'resolved field not updated in package-lock'
          )
        })
    })
})

test('it works with git dependencies', t => {
  return mockTar({
    // This makes a tarball so we can get an integrity hash for it
    'package.json': JSON.stringify({
      name: 'bar',
      version: '1.0.1'
    }),
    'index.js': 'hi'
  }, {gzip: false})
    .then(tarData => ssri.fromData(tarData).toString())
    .then(integrity => {
      fs.writeFileSync(path.resolve(__dirname, 'bin-stubs/git'), [
        '#!/usr/bin/env bash',
        'echo \'{"name":"bar","version":"1.0.1"}\' > package.json',
        'echo hi > index.js'
      ].join('\n'))
      const fixture = new Tacks(Dir({
        'package.json': File({
          name: 'foo',
          version: '1.2.3',
          dependencies: {
            bar: 'github:npm/bar#6d75a6a'
          }
        }),
        'package-lock.json': File({
          name: 'foo',
          lockfileVersion: 1,
          requires: true,
          dependencies: {
            bar: {
              version: 'github:npm/bar#6d75a6a'
            }
          }
        })
      }))
      fixture.create(testDir)
      const config = mockConfig(testDir, {registry: REGISTRY})
      const archivedResolved = `file:archived-packages/bar-github-npm-bar-6d75a6a.tar`
      return new MyPrecious({log: npmlog, config})
        .run()
        .then(() => fs.readFileAsync('package-lock.json', 'utf8'))
        .then(JSON.parse)
        .then(pkgLock => {
          t.equal(
            pkgLock.dependencies.bar.resolved,
            archivedResolved,
            'resolved field updated in npm-shrinkwrap'
          )
          return fs.readFileAsync(archivedResolved.substr(5))
            .then(tarData => {
              const newSri = pkgLock.dependencies.bar.integrity
              t.ok(
                ssri.checkData(tarData, newSri),
                'archived tarball passes integrity check'
              )
              t.ok(
                ssri.checkData(tarData, newSri),
                'updated integrity field still matches old tgzData'
              )
              t.notOk(
                ssri.checkData('blah', newSri),
                'updated integrity field is actually checking data at all'
              )
            })
        })
    })
})

test('it works with npm-shrinkwrap files', t => {
  return mockTar({
    // This makes the tarball for `bar` itself, to be hosted by tnock
    'package.json': JSON.stringify({
      name: 'bar',
      version: '1.0.1'
    }),
    'index.js': 'hi'
  }, {gzip: true})
    .then(tgzData => {
      const integrity = ssri.fromData(tgzData).toString()
      const fixture = new Tacks(Dir({
        'package.json': File({
          name: 'foo',
          version: '1.2.3',
          dependencies: {
            bar: '^1.0.0'
          }
        }),
        'npm-shrinkwrap.json': File({
          name: 'foo',
          lockfileVersion: 1,
          requires: true,
          dependencies: {
            bar: {
              version: '1.0.1',
              resolved: REGISTRY + 'bar/-/bar-1.0.1.tgz',
              integrity
            }
          }
        })
      }))
      fixture.create(testDir)
      const config = mockConfig(testDir, {registry: REGISTRY})
      tnock(t, REGISTRY).get('/bar/-/bar-1.0.1.tgz').reply(200, tgzData)
      const archivedResolved = `file:archived-packages/bar-1.0.1-${ssri.parse(integrity).hexDigest().slice(0, 9)}.tar`
      return new MyPrecious({log: npmlog, config})
        .run()
        .then(() => fs.readFileAsync('npm-shrinkwrap.json', 'utf8'))
        .then(JSON.parse)
        .then(pkgLock => {
          t.equal(
            pkgLock.dependencies.bar.resolved,
            archivedResolved,
            'resolved field updated in npm-shrinkwrap'
          )
          return fs.readFileAsync(archivedResolved.substr(5))
            .then(tarData => {
              const newSri = pkgLock.dependencies.bar.integrity
              t.ok(tarData.length > tgzData.length, 'tarball is gunzipped')
              t.ok(
                ssri.checkData(tarData, newSri),
                'archived tarball passes integrity check'
              )
              t.ok(
                ssri.checkData(tgzData, newSri),
                'updated integrity field still matches old tgzData'
              )
              t.notOk(
                ssri.checkData('blah', newSri),
                'updated integrity field is actually checking data at all'
              )
            })
        })
    })
})

test('fails if package-lock.json is out of sync with package.json', t => {
  return mockTar({
    // This makes the tarball for `bar` itself, to be hosted by tnock
    'package.json': JSON.stringify({
      name: 'bar',
      version: '1.0.1'
    }),
    'index.js': 'hi'
  }, {gzip: true})
    .then(tgzData => {
      const integrity = ssri.fromData(tgzData).toString()
      const fixture = new Tacks(Dir({
        'package.json': File({
          name: 'foo',
          version: '1.2.3',
          dependencies: {
            bar: '^1.0.0',
            baz: '^2.0.0'
          }
        }),
        'package-lock.json': File({
          name: 'foo',
          lockfileVersion: 1,
          requires: true,
          dependencies: {
            bar: {
              version: '1.0.1',
              resolved: REGISTRY + 'bar/-/bar-1.0.1.tgz',
              integrity
            }
          }
        })
      }))
      fixture.create(testDir)
      const config = mockConfig(testDir, {registry: REGISTRY, loglevel: 'warn'})
      return new MyPrecious({log: npmlog, config})
        .run()
        .then(() => { throw new Error('Should not pass') }, error => {
          t.type(
            error, Error,
            'given an Error object'
          )
          t.match(
            error.message, /are in sync/i,
            'error message reflects lack of package-lock.json'
          )
          t.match(
            error.message, /Missing: baz@\^2.0.0/i,
            'error message includes summary of missing deps'
          )
        })
    })
})

test('fails if package-lock.json and npm-shrinkwrap are both missing', t => {
  return mockTar({
    // This makes the tarball for `bar` itself, to be hosted by tnock
    'package.json': JSON.stringify({
      name: 'bar',
      version: '1.0.1'
    }),
    'index.js': 'hi'
  }, {gzip: true})
    .then(tgzData => {
      const fixture = new Tacks(Dir({
        'package.json': File({
          name: 'foo',
          version: '1.2.3',
          dependencies: {
            bar: '^1.0.0'
          }
        })
      }))
      fixture.create(testDir)
      const config = mockConfig(testDir, {registry: REGISTRY})
      return new MyPrecious({log: npmlog, config})
        .run()
        .then(() => { throw new Error('Should not pass') }, error => {
          t.type(
            error, Error,
            'given an Error object'
          )
          t.match(
            error.message, /we can only install packages with an existing package-lock.json/i,
            'error message reflects lack of package-lock.json'
          )
        })
    })
})

test('fails if package.json is malformed', t => {
  return mockTar({
    // This makes the tarball for `bar` itself, to be hosted by tnock
    'package.json': JSON.stringify({
      name: 'bar',
      version: '1.0.1'
    }),
    'index.js': 'hi'
  }, {gzip: true})
    .then(tgzData => {
      const integrity = ssri.fromData(tgzData).toString()
      const fixture = new Tacks(Dir({
        'package.json': File(JSON.stringify({
          name: 'foo',
          version: '1.2.3',
          dependencies: {
            bar: '^1.0.0'
          }
        }) + 'malformed-package!'),
        'package-lock.json': File({
          name: 'foo',
          lockfileVersion: 1,
          requires: true,
          dependencies: {
            bar: {
              version: '1.0.1',
              resolved: REGISTRY + 'bar/-/bar-1.0.1.tgz',
              integrity
            }
          }
        })
      }))
      fixture.create(testDir)
      const config = mockConfig(testDir, {registry: REGISTRY})
      return new MyPrecious({log: npmlog, config})
        .run()
        .then(() => { throw new Error('Should not pass') }, error => {
          t.type(
            error, SyntaxError,
            'given a syntax error object'
          )
          t.match(
            error.message, /unexpected token/i,
            'error message reflects json parse error'
          )
        })
    })
})

test('fails if package-lock.json is malformed', t => {
  return mockTar({
    // This makes the tarball for `bar` itself, to be hosted by tnock
    'package.json': JSON.stringify({
      name: 'bar',
      version: '1.0.1'
    }),
    'index.js': 'hi'
  }, {gzip: true})
    .then(tgzData => {
      const integrity = ssri.fromData(tgzData).toString()
      const fixture = new Tacks(Dir({
        'package.json': File({
          name: 'foo',
          version: '1.2.3',
          dependencies: {
            bar: '^1.0.0'
          }
        }),
        'package-lock.json': File(JSON.stringify({
          name: 'foo',
          lockfileVersion: 1,
          requires: true,
          dependencies: {
            bar: {
              version: '1.0.1',
              resolved: REGISTRY + 'bar/-/bar-1.0.1.tgz',
              integrity
            }
          }
        }) + 'malformed-package!')
      }))
      fixture.create(testDir)
      const config = mockConfig(testDir, {registry: REGISTRY})
      return new MyPrecious({log: npmlog, config})
        .run()
        .then(() => { throw new Error('Should not pass') }, error => {
          t.type(
            error, SyntaxError,
            'given a syntax error object'
          )
          t.match(
            error.message, /unexpected token/i,
            'error message reflects json parse error'
          )
        })
    })
})

test('fails if npm-shrinkwrap.json is malformed', t => {
  return mockTar({
    // This makes the tarball for `bar` itself, to be hosted by tnock
    'package.json': JSON.stringify({
      name: 'bar',
      version: '1.0.1'
    }),
    'index.js': 'hi'
  }, {gzip: true})
    .then(tgzData => {
      const integrity = ssri.fromData(tgzData).toString()
      const fixture = new Tacks(Dir({
        'package.json': File({
          name: 'foo',
          version: '1.2.3',
          dependencies: {
            bar: '^1.0.0'
          }
        }),
        'npm-shrinkwrap.json': File(JSON.stringify({
          name: 'foo',
          lockfileVersion: 1,
          requires: true,
          dependencies: {
            bar: {
              version: '1.0.1',
              resolved: REGISTRY + 'bar/-/bar-1.0.1.tgz',
              integrity
            }
          }
        }) + 'malformed-package!')
      }))
      fixture.create(testDir)
      const config = mockConfig(testDir, {registry: REGISTRY})
      return new MyPrecious({log: npmlog, config})
        .run()
        .then(() => { throw new Error('Should not pass') }, error => {
          t.type(
            error, SyntaxError,
            'given a syntax error object'
          )
          t.match(
            error.message, /unexpected token/i,
            'error message reflects json parse error'
          )
        })
    })
})

'use strict'

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

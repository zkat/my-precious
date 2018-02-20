#!/usr/bin/env node

'use strict'

const MyPrecious = require('libprecious')
const npmlog = require('npmlog')
const fromNpm = require('libprecious/lib/config/npm-config.js').fromNpm

if (require.main === module) {
  cliMain()
}

module.exports = cliMain
function cliMain () {
  return fromNpm(process.argv)
  .then(config => {
    npmlog.level = config.get('loglevel')
    return new MyPrecious({
      config,
      log: npmlog
    })
  })
  .then(precious => precious.run())
  .then(
    details => console.error(`saved ${
      details.pkgCount
    } tarballs in ${
      details.runTime / 1000
    }s`),
    err => console.error(`my-precious failed:
      n${err.message}\n${err.stack}`)
  )
}

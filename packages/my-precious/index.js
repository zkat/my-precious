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
  .then(details => {
    const clauses = []
    if (!details.pkgCount && !details.removed) {
      clauses.push('done')
    }
    if (details.pkgCount) {
      clauses.push(`archived ${details.pkgCount} package${
        details.pkgCount === 1 ? '' : 's'
      }`)
    }
    if (details.removed) {
      clauses.push(`cleaned up ${details.pkgCount} archive${
        details.removed === 1 ? '' : 's'
      }`)
    }
    const time = details.runTime / 1000
    console.error(`${clauses.join(' and ')} in ${time}s`)
  })
  .catch(err => {
    npmlog.error('', err.message)
    npmlog.verbose('', err.stack)
  })
}

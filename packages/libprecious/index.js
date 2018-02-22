'use strict'

const BB = require('bluebird')

const buildLogicalTree = require('npm-logical-tree')
const detectIndent = require('detect-indent')
const fs = require('graceful-fs')
const getPrefix = require('find-npm-prefix')
const lockVerify = require('lock-verify')
const mkdirp = BB.promisify(require('mkdirp'))
const npa = require('npm-package-arg')
const pacote = require('pacote')
const pacoteOpts = require('./lib/config/pacote-opts.js')
const path = require('path')
const ssri = require('ssri')
const zlib = require('zlib')

const readFileAsync = BB.promisify(fs.readFile)
const statAsync = BB.promisify(fs.stat)
const writeFileAsync = BB.promisify(fs.writeFile)

class MyPrecious {
  constructor (opts) {
    this.opts = opts
    this.config = opts.config

    // Stats
    this.startTime = Date.now()
    this.runTime = 0
    this.pkgCount = 0

    // Misc
    this.log = this.opts.log || require('./lib/silentlog.js')
    this.pkg = null
    this.tree = null
  }

  run () {
    return this.prepare()
    .then(() => this.saveTarballs(this.tree))
    .then(() => this.updateLockfile(this.tree))
    .then(() => this.teardown())
    .then(() => { this.runTime = Date.now() - this.startTime })
    .catch(err => { this.teardown(); throw err })
    .then(() => this)
  }

  prepare () {
    this.log.level = this.config.get('loglevel')

    return (
      this.config.get('prefix') && this.config.get('global')
      ? BB.resolve(this.config.get('prefix'))
      // There's some Special™ logic around the `--prefix` config when it
      // comes from a config file or env vs when it comes from the CLI
      : process.argv.some(arg => arg.match(/^\s*--prefix\s*/i))
      ? this.config.get('prefix')
      : getPrefix(process.cwd())
    )
    .then(prefix => {
      this.prefix = prefix
      this.log.silly('init', 'prefix: ' + prefix)
      return BB.join(
        readJson(prefix, 'package.json'),
        readJson(prefix, 'package-lock.json', true),
        readJson(prefix, 'npm-shrinkwrap.json', true),
        (pkg, lock, shrink) => {
          pkg._shrinkwrap = shrink || lock
          this.pkg = pkg
          this.lockName = shrink ? 'npm-shrinkwrap.json' : 'package-lock.json'
        }
      )
    })
    .then(() => statAsync(
      path.join(this.prefix, 'node_modules')
    ).catch(err => { if (err.code !== 'ENOENT') { throw err } }))
    .then(stat => this.checkLock())
    .then(() => {
      this.tree = buildLogicalTree(this.pkg, this.pkg._shrinkwrap)
      this.log.silly('tree', this.tree)
    })
  }

  teardown () {
    return BB.resolve()
  }

  checkLock () {
    this.log.silly('checkLock', 'verifying package-lock data')
    const pkg = this.pkg
    const prefix = this.prefix
    if (!pkg._shrinkwrap || !pkg._shrinkwrap.lockfileVersion) {
      return BB.reject(
        new Error(`we can only install packages with an existing package-lock.json or npm-shrinkwrap.json with lockfileVersion >= 1. Run an install with npm@5 or later to generate it, then try again.`)
      )
    }
    return lockVerify(prefix).then(result => {
      if (result.status) {
        result.warnings.forEach(w => this.log.warn('lockfile', w))
      } else {
        throw new Error(
          'we can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.\n\n' +
          result.warnings.map(w => 'Warning: ' + w).join('\n') + '\n' +
          result.errors.join('\n') + '\n'
        )
      }
    })
  }

  saveTarballs (tree) {
    this.log.silly('extractTree', 'extracting dependencies to node_modules/')
    return tree.forEachAsync((dep, next) => {
      if (!this.checkDepEnv(dep)) { return }
      const spec = npa.resolve(dep.name, dep.version, this.prefix)
      if (dep.isRoot || spec.type === 'directory' || dep.bundled) {
        return next()
      } else {
        const pkgPath = this.getTarballPath(spec, dep)
        const opts = pacoteOpts(this.config, {
          resolved: dep.resolved,
          integrity: dep.integrity
        })
        return mkdirp(path.dirname(pkgPath))
        .then(() => new BB((resolve, reject) => {
          const tardata = pacote.tarball.stream(spec, opts)
          const gunzip = zlib.createGunzip()
          const sriStream = ssri.integrityStream({
            algorithms: dep.integrity && Object.keys(ssri.parse(dep.integrity))
          })
          const out = fs.createWriteStream(pkgPath)
          let integrity
          sriStream.on('integrity', i => { integrity = i })
          tardata.on('error', reject)
          gunzip.on('error', reject)
          sriStream.on('error', reject)
          out.on('error', reject)
          out.on('close', () => resolve(integrity))
          tardata
          .pipe(gunzip)
          .pipe(sriStream)
          .pipe(out)
        }))
        .then(tarIntegrity => {
          dep.resolved = `file:${path.relative(this.prefix, pkgPath)}`
          dep.integrity = tarIntegrity.concat(dep.integrity || '').toString()
          this.log.silly('saveTarballs', `${spec} -> ${pkgPath}`)
        })
        .then(() => next())
        .then(() => { this.pkgCount++ })
      }
    }, {concurrency: 50, Promise: BB})
  }

  checkDepEnv (dep) {
    const includeDev = (
      // Covers --dev and --development (from npm config itself)
      this.config.get('dev') ||
      (
        !/^prod(uction)?$/.test(this.config.get('only')) &&
        !this.config.get('production')
      ) ||
      /^dev(elopment)?$/.test(this.config.get('only')) ||
      /^dev(elopment)?$/.test(this.config.get('also'))
    )
    const includeProd = !/^dev(elopment)?$/.test(this.config.get('only'))
    return (dep.dev && includeDev) || (!dep.dev && includeProd)
  }

  getTarballPath (spec, dep) {
    // TODO - this is obviously not good enough, but it's good for a demo
    const filename = `${spec.name}-${dep.version}.tar`
    return path.join(this.prefix, 'archived-packages', filename)
  }

  updateLockfile (tree) {
    tree.forEach((dep, next) => {
      if (dep.isRoot) { return next() }
      const physDep = dep.address.split(':').reduce((obj, name, i) => {
        return obj.dependencies[name]
      }, this.pkg._shrinkwrap)
      physDep.resolved = dep.resolved
      physDep.integrity = dep.integrity
      next()
    })
    const lockPath = path.join(this.prefix, this.lockName)
    return readFileAsync(lockPath, 'utf8')
    .then(file => detectIndent(file).indent || 2)
    .then(indent => writeFileAsync(
      lockPath,
      JSON.stringify(this.pkg._shrinkwrap, null, indent)
    ))
  }
}
module.exports = MyPrecious
module.exports.PreciousConfig = require('./lib/config/npm-config.js').PreciousConfig

function stripBOM (str) {
  return str.replace(/^\uFEFF/, '')
}

module.exports._readJson = readJson
function readJson (jsonPath, name, ignoreMissing) {
  return readFileAsync(path.join(jsonPath, name), 'utf8')
  .then(str => JSON.parse(stripBOM(str)))
  .catch({code: 'ENOENT'}, err => {
    if (!ignoreMissing) {
      throw err
    }
  })
}

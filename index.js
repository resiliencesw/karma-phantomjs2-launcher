var fs = require('fs')
var path = require('path')
var _ = require('lodash')

function serializeOption (value) {
  if (typeof value === 'function') {
    return value.toString()
  }
  return JSON.stringify(value)
}

var phantomJSExePath = function () {
  // If the path we're given by phantomjs is to a .cmd, it is pointing to a global copy.
  // Using the cmd as the process to execute causes problems cleaning up the processes
  // so we walk from the cmd to the phantomjs.exe and use that instead.

  var phantomSource = require('phantomjs2-ext').path

  if (path.extname(phantomSource).toLowerCase() === '.cmd') {
    return path.join(path.dirname( phantomSource ), '//node_modules//phantomjs2-ext//lib//phantom//phantomjs.exe')
  }

  return phantomSource
}

var PhantomJSBrowser = function (baseBrowserDecorator, config, args, logger) {
  var log = logger.create('phantomjs.launcher')

  baseBrowserDecorator(this)

  var options = args && args.options || config && config.options || {}
  var flags = args && args.flags || config && config.flags || []

  this._start = function (url) {
    // create the js file that will open karma
    var captureFile = this._tempDir + '/capture.js'
    var pageOptions = {}
    var pageSettingsOptions = {}

    _.forOwn(options, function (optionsValue, optionsKey) {
      if (optionsKey !== 'settings') { // settings cannot be overriden, it should be extended!
        pageOptions[optionsKey] = serializeOption(optionsValue)
      } else {
        // key === settings
        _.forOwn(optionsValue, function (settingsValue, settingsKey) {
          pageSettingsOptions[settingsKey] = serializeOption(settingsValue)
        })
      }
    })

    if (args.debug) {
      flags = flags.concat('--remote-debugger-port=9000')
      flags = flags.concat('--remote-debugger-autorun=yes')
    }

    var file = fs.readFileSync(path.join(__dirname, 'capture.template.js'))

    var compiled = _.template(file.toString())
    var captureCode = compiled({
      debug: args.debug,
      exitOnResourceError: config && config.exitOnResourceError,
      pageOptions: pageOptions,
      pageSettingsOptions: pageSettingsOptions,
      url: url
    })

    fs.writeFileSync(captureFile, captureCode)

    flags = flags.concat(captureFile)

    // and start phantomjs
    this._execCommand(this._getCommand(), flags)

    if (args.debug) {
      log.info('ACTION REQUIRED:')
      log.info('')
      log.info('  Launch browser at')
      log.info('  http://localhost:9000/webkit/inspector/inspector.html?page=2')
      log.info('')
      log.info('Waiting 15 seconds ...')
    }
  }
}

PhantomJSBrowser.prototype = {
  name: 'PhantomJS2',

  DEFAULT_CMD: {
    linux: require('phantomjs2-ext').path,
    darwin: require('phantomjs2-ext').path,
    win32: phantomJSExePath()
  },
  ENV_CMD: 'PHANTOMJS_BIN'
}

PhantomJSBrowser.$inject = ['baseBrowserDecorator', 'config.phantomjsLauncher', 'args', 'logger']

// PUBLISH DI MODULE
module.exports = {
  'launcher:PhantomJS2': ['type', PhantomJSBrowser]
}

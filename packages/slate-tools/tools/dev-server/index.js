const path = require('path');
const fs = require('fs');
const env = require('@shopify/slate-env');
const webpack = require('webpack');
const {createServer} = require('https');
const {SyncHook} = require('tapable');
const createHash = require('crypto').createHash;

const App = require('./app');
const Client = require('./client');
const ssl = require('./ssl');
const config = require('../../slate-tools.config');
const setEnvironment = require('../../tools/webpack/set-slate-env');

module.exports = class DevServer {
  constructor(options) {
    this.firstCompile = true;
    this.assetHashes = {};
    this.options = options;
    this.env = setEnvironment(options.env);
    this.compiler = webpack(options.webpackConfig);
    this.app = new App(this.compiler);
    this.client = new Client();
    this.client.hooks.afterSync.tap(
      'HotMiddleWare',
      this._onAfterSync.bind(this),
    );
  }

  start() {
    this.compiler.hooks.done.tap('DevServer', this._onCompileDone.bind(this));
    this.server = createServer(ssl(config), this.app);
    this.server.listen(config.port);
  }

  set files(files) {
    this.client.files = files;
  }

  set skipDeploy(value) {
    this.client.skipNextSync = value;
  }

  _onCompileDone(stats) {
    let files;

    if (this.firstCompile) {
      files = Object.entries(stats.compilation.assets).map(([key, asset]) =>
        asset.existsAt.replace(config.paths.dist, ''),
      );
    } else {
      files = this._getChangedLiquidFiles(stats);
    }

    this.client.sync(files);
  }

  _onAfterSync(files) {
    this.app.webpackHotMiddleware.publish({
      action: 'shopify_upload_finished',
      force: files.length > 0,
    });
  }

  _getChangedLiquidFiles(stats) {
    const assets = Object.entries(stats.compilation.assets);

    return assets
      .filter(([key, asset]) => {
        const oldHash = this.assetHashes[key];
        const newHash = this._updateAssetHash(key, asset);

        return (
          asset.emitted &&
          key !== 'static.js' &&
          fs.existsSync(asset.existsAt) &&
          oldHash !== newHash
        );
      })
      .map(([key, asset]) => {
        return asset.existsAt.replace(config.paths.dist, '');
      });
  }

  _updateAssetHash(key, asset) {
    const rawSource = asset.source();
    const source = Array.isArray(rawSource) ? rawSource.join('\n') : rawSource;
    const hash = createHash('sha256')
      .update(source)
      .digest('hex');

    return (this.assetHashes[key] = hash);
  }
};

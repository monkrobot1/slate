const argv = require('minimist')(process.argv.slice(2));
const figures = require('figures');
const chalk = require('chalk');
const ora = require('ora');
const consoleControl = require('console-control-strings');
const clearConsole = require('react-dev-utils/clearConsole');
const openBrowser = require('react-dev-utils/openBrowser');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const env = require('@shopify/slate-env');
const {event} = require('@shopify/slate-analytics');

const promptContinueIfPublishedTheme = require('../prompts/continue-if-published-theme');
const promptSkipSettingsData = require('../prompts/skip-settings-data');
const DevServer = require('../../tools/dev-server');
const webpackConfig = require('../../tools/webpack/config/dev');
const config = require('../../slate-tools.config');
const packageJson = require('../../package.json');

const options = {
  env: argv.env,
  skipFirstDeploy: argv.skipFirstDeploy,
  webpackConfig,
};
const spinner = ora(chalk.magenta(' Compiling...'));
const firstCompile = true;
let firstSync = true;
let skipSettingsData = null;
let continueIfPublishedTheme = null;

const devServer = new DevServer(options);
const previewUrl = `https://${env.getStoreValue()}?preview_theme_id=${env.getThemeIdValue()}`;

devServer.compiler.hooks.compile.tap('CLI', () => {
  clearConsole();
  spinner.start();
});

devServer.compiler.hooks.done.tap('CLI', (stats) => {
  const statsJson = stats.toJson({}, true);
  const messages = formatWebpackMessages(statsJson);

  spinner.stop();
  clearConsole();

  if (messages.errors.length) {
    event('slate-tools:start:compile-errors', {
      errors: messages.errors,
      version: packageJson.version,
    });

    console.log(chalk.red('Failed to compile.\n'));
    console.log(config.paths.lib);

    messages.errors.forEach((message) => {
      console.log(`${message}\n`);
    });
  }

  if (messages.warnings.length) {
    event('slate-tools:start:compile-warnings', {
      duration: statsJson.time,
      warnings: messages.warnings,
      version: packageJson.version,
    });

    console.log(chalk.yellow('Compiled with warnings.\n'));

    messages.warnings.forEach((message) => {
      console.log(`${message}\n`);
    });
  }

  if (!messages.errors.length && !messages.warnings.length) {
    event('slate-tools:start:compile-success', {
      duration: statsJson.time,
      version: packageJson.version,
    });

    console.log(
      `${chalk.green(figures.tick)}  Compiled successfully in ${statsJson.time /
        1000}s!`,
    );
  }
});

devServer.client.hooks.beforeSync.tapPromise('CLI', async (files) => {
  if (firstSync && argv.skipFirstDeploy) {
    return (devServer.skipDeploy = true);
  }

  if (continueIfPublishedTheme === null) {
    continueIfPublishedTheme = await promptContinueIfPublishedTheme();
  }

  if (!continueIfPublishedTheme) {
    process.exit(0);
  }

  if (skipSettingsData === null) {
    skipSettingsData = await promptSkipSettingsData(files);
  }

  if (skipSettingsData) {
    devServer.files = files.filter(
      (file) => !file.endsWith('settings_data.json'),
    );
  }
});

devServer.client.hooks.syncSkipped.tap('CLI', () => {
  if (firstSync && argv.skipFirstDeploy) {
    event('slate-tools:start:skip-first-deploy', {
      version: packageJson.version,
    });

    console.log(
      `\n${chalk.blue(
        figures.info,
      )}  Skipping first deployment because --skipFirstDeploy flag`,
    );
  }
});

devServer.client.hooks.sync.tap('CLI', () => {
  event('slate-tools:start:sync-start', {version: packageJson.version});
});

devServer.client.hooks.syncDone.tap('CLI', () => {
  event('slate-tools:start:sync-end', {version: packageJson.version});

  process.stdout.write(consoleControl.previousLine(4));
  process.stdout.write(consoleControl.eraseData());

  console.log(
    `\n${chalk.green(
      figures.tick,
    )}  Files uploaded successfully! Your theme is running at:\n`,
  );
  console.log(`      ${chalk.cyan(previewUrl)}`);
});

devServer.client.hooks.afterSync.tap('CLI', () => {
  console.log(chalk.magenta('\nWatching for changes...'));

  if (firstSync) {
    openBrowser(previewUrl);
  }

  firstSync = false;
});

event('slate-tools:start:start', {version: packageJson.version, webpackConfig});
devServer.start();

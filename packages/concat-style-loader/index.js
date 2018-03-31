const fs = require('fs');
const path = require('path');
const {getOptions} = require('loader-utils');

const {concatStyles} = require('./concat');

const defaults = {
  ignoreComments: true,
  //     extensions: null,
  //     includePaths: [],
  //     filter: null,
  //     matchPattern: null,
  //     matchOptions: {
  //         matchBase: true
  //     },
  //     limit: 5000,
  //     transform: null
};

module.exports = function(content) {
  const options = getOptions(this);
  const rootPath = this.resourcePath;

  content = concatStyles(content, rootPath);

  return `module.exports = ${JSON.stringify(content)}`;
};

'use strict';

const canonicalize = require('./canonicalize.js');

const prettyprint = async (zobject) => {
  return JSON.stringify(await canonicalize.canonicalize(zobject), null, '\t');
};

const prettyprintAsync = async (zobject) => {
  return new Promise((resolve, reject) => {
    resolve(prettyprint(zobject));
  });
};

exports.prettyprint = prettyprint;
exports.prettyprintAsync = prettyprintAsync;

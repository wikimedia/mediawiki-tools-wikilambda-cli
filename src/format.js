'use strict';

const c = require('./constants.js').constants;
const labelize = require('./labelize.js');
const utils = require('./utils.js');

// TODO: break into formatArray, formatString, formatType, etc.
// TODO: do that before writing tests!
async function format(output, lang) {
  async function formatAtLevel(output, indent = 0) {
    if (utils.isArray(output)) {
      if (output.length === 0) {
        return '[]';
      }
      let result = '[';
      for (const element of output) {
        result += '\n' + '  '.repeat(indent + 1);
        result += await formatAtLevel(element, indent + 1);
      }
      result += '\n' + '  '.repeat(indent) + ']';
      return result;
    }
    if (utils.isString(output)) {
      if (utils.isZid(output)) {
        return await labelize.labelizeId(output);
      }
      return '"' + output + '"';
    }
    if (utils.isObject(output)) {
      if (output[c.ObjectType] === c.String) {
        return '"' + output[c.StringValue] + '"';
      }
      if (output[c.ObjectType] === c.Type) {
        let result = await labelize.labelizeId(c.Type) + ': ';
        result += await formatAtLevel(output[c.TypeIdentity], indent + 1);
        for (const key of output[c.TypeKeys]) {
          result += '\n' + '  '.repeat(indent + 1);
          result += await formatAtLevel(key[c.KeyType]) + ': ';
          result += utils.getLabel(key[c.KeyLabels], lang);
        }
        return result;
      }
      if (output[c.ObjectType] === c.Function) {
        let result = await formatAtLevel(output[c.FunctionIdentity], indent + 1);
        result += ': ';
        const functionArguments = output[c.FunctionArguments];
        // Drop the type at the beginning of the Benjamin array.
        functionArguments.shift();
        let first = true;
        for (const key of functionArguments) {
          if (!first) {
            result += ', ';
          }
          first = false;
          result += await formatAtLevel(key[c.ArgumentType]);
        }
        result += ' → ';
        result += await formatAtLevel(output[c.FunctionReturntype]);
        return result;
      }
      if (output[c.ObjectType] === c.Functioncall) {
        let result = '';
        let first = true;
        for (const key in output) {
          if (key === c.ObjectType) {
            continue;
          }
          if (key === c.FunctioncallFunction) {
            result += await formatAtLevel(output[c.FunctioncallFunction]) + '(';
            continue;
          }
          if (!first) {
            result += ', ';
          }
          first = false;
          result += await formatAtLevel(output[key]);
        }
        result += ')';
        return result;
      }
      if (output[c.ObjectType] === c.Reference) {
        return await formatAtLevel(output[c.ReferenceValue], indent);
      }
      if (output[c.ObjectType] === c.Boolean) {
        return await formatAtLevel(output[c.BooleanValue], indent);
      }
      // if (Object.keys(output).length === 2) {
      //  return await formatAtLevel(output[Object.keys(output)[1]], indent);
      // }
      let typeid = '';
      if (utils.isZid(output[c.ObjectType])) {
        typeid = output[c.ObjectType];
      } else {
        typeid = output[c.ObjectType][c.TypeIdentity];
      }
      let result = await labelize.labelizeId(typeid);
      for (const key in output) {
        if (key === c.ObjectType) {
          continue;
        }
        result += '\n' + '  '.repeat(indent + 1);
        result += await labelize.labelizeId(key) + ': ';
        result += await formatAtLevel(output[key], indent + 1);
      }
      return result;
    }
    return output;
  }
  return formatAtLevel(output);
}

const formatTokens = (tokens, lang) => {
  let result = '';
  tokens.forEach((token, i) => {
    result += token[c.TokenType];
    if (token[c.TokenValue] !== undefined) {
      if (token[c.TokenZid] !== undefined) {
        result += '(' + token[c.TokenZid] + ')';
      } else {
        result += '(' + token[c.TokenValue] + ')';
      }
    }
    result += ' ';
  });
  return result;
};

exports.formatTokens = formatTokens;
exports.format = format;

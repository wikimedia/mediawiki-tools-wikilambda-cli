'use strict';

const c = require('./constants.js').constants;
const { parseAsync } = require('./parse.js');

const TEMPLATE = 'ZTemplate';
const TEMPLATETEXT = 'ZTemplateText';
const TEMPLATENODE = 'ZTemplateNode';
const ROOT = 'root';

const ROOTINDEX = 'K1';
const TEMPLATENODES = 'K2';
const TARGET = 'K1';
const SOURCE = 'K2';
const WRAPPEDCALL = 'K3';

const error = (message) => {
    return {
        [c.ObjectType]: c.Error,
        [c.ErrorType]: message
    };
};

const segmentize = async (input) => {
    // TODO(relgu): Handle punctiation specially (if required).
    const segments = [];
    let insideSlot = false;
    let segment = '';
    for (const character of input) {
        if (character === '{') {
            insideSlot = true;
        } else if (character === '}') {
            segments.push(segment + '}');
            segment = '';
            insideSlot = false;
            continue;
        } else if (character === ' ' && !insideSlot) {
            if (segment) {
                segments.push(segment);
            }
            segment = '';
            continue;
        }
        segment += character;
    }
    if (segment) {
        segments.push(segment);
    }
    return segments;
};

const isSlot = (element) => {
    return (element[0] === '{' && element.slice(-1) === '}');
};

// Splits a slot into its label, source (if given) and function invocation
// The general syntax of a slot is {label<source:invocation()}
const breakDownSlot = (slot) => {
    slot = slot.slice(1, -1);  // remove the { } characters
    const result = { label: null, role: null, source: null, invocation: null };
    // First identify the label (if it's there)
    const mainSplit = slot.split(':', 2);
    if (mainSplit.length === 1) {
        result.invocation = mainSplit[0];
        return result;
    }
    result.invocation = mainSplit[1];
    const labelSplit = mainSplit[0].split('<', 2);
    result.label = labelSplit[0];
    if (labelSplit.length === 2) {
        result.source = labelSplit[1];
    }
    return result;
};

const getLabelFunction = async (label) => {
    const role = label.split('_', 1)[0];  // The label can be of form role_index;
    // TODO(relgu): Delabel role into a Zid, dynamically taking language into account
    return role;
};

const addRelationCalls = async (templateCall, labelIndexMap, labelSourceMap, rootIndex) => {
    rootIndex = templateCall[ROOTINDEX];
    let call = templateCall;
    for (const [ label, index ] of labelIndexMap) {
        const functionName = await getLabelFunction(label);
        const wrapperCall = {
            [c.ObjectType]: c.Functioncall,
            [c.FunctioncallFunction]: functionName
        };
        wrapperCall[TARGET] = index;
        const source = labelSourceMap.has(label) ?
            labelIndexMap.get(labelSourceMap.get(label)) : rootIndex;
        if (!source) {
            return error('Source label not found: ' + labelSourceMap.get(label));
        }
        wrapperCall[SOURCE] = source;
        wrapperCall[WRAPPEDCALL] = call;
        call = wrapperCall;
    }
    return call;
};

const wrapAsTemplateText = async (text) => {
    return {
        [c.ObjectType]: c.Functioncall,
        [c.FunctioncallFunction]: TEMPLATETEXT,
        [c.Key1]: text
    };
};

const buildBasicTemplateCall = async (elements, labelIndexMap, labelSourceMap) => {
    const templateCall = {
        [c.ObjectType]: c.Functioncall,
        [c.FunctioncallFunction]: TEMPLATE
    };
    let index = 1;  // one-based indexing
    let rootIndex = -1;
    let firstSlot = -1;
    const args = [ TEMPLATENODE ];  // The first element indicates the type of the list elements
    for (const element of elements) {
        if (isSlot(element)) {
            if (firstSlot === -1) {
                firstSlot = index;
            }
            const slotComponents = breakDownSlot(element);
            let argument = await parseAsync(slotComponents.invocation);
            if (argument[c.ObjectType] === c.String) {
                argument = await wrapAsTemplateText(argument[c.StringValue]);
            }
            if (argument[c.ObjectType] === c.Error) {
                return argument;
            }
            args.push(argument);
            if (slotComponents.label) {
                if (slotComponents.label === ROOT) {
                    if (rootIndex > -1) {
                        return error('duplicate ' + ROOT + ' label encountered at position:', index);
                    }
                    rootIndex = index;
                } else {
                    labelIndexMap.set(slotComponents.label, index);
                    if (slotComponents.source) {
                        labelSourceMap.set(slotComponents.label, slotComponents.source);
                    }
                }
            }
        } else {
            args.push(await wrapAsTemplateText(element));
        }
        index++;
    }
    if (rootIndex === -1) {
        // Root inferral is only allowed if no labels are used; in this case,
        // the first slot will be considered the root, and in its absence, the
        // first element.
        if (labelIndexMap.size > 0) {
            return error('You have to specify a root label, when using labels.');
        }
        rootIndex = firstSlot > -1 ? firstSlot : 1;
    }
    templateCall[ROOTINDEX] = rootIndex;
    templateCall[TEMPLATENODES] = args;
    return templateCall;
};

const buildTemplate = async (input) => {
    const elements = await segmentize(input);
    const labelIndexMap = new Map();
    const labelSourceMap = new Map();
    let call = {};
    call =  await buildBasicTemplateCall(elements, labelIndexMap, labelSourceMap);
    if (call[c.ObjectType] === c.Error) {
        return call;
    }
    return await addRelationCalls(call, labelIndexMap, labelSourceMap);
};

exports.buildTemplate = buildTemplate;

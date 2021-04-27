"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csucc = exports.cgreen = exports.cerr = exports.cred = exports.debug = exports.enableDebug = exports.isDebugEnabled = exports.GREEN_CHECK = exports.RED_CROSS = void 0;
exports.RED_CROSS = cred `✗`;
exports.GREEN_CHECK = cgreen `✓`;
let DEBUG_ENABLED = false;
function isDebugEnabled() {
    return DEBUG_ENABLED;
}
exports.isDebugEnabled = isDebugEnabled;
function enableDebug(debugEnabled = true) {
    DEBUG_ENABLED = debugEnabled;
}
exports.enableDebug = enableDebug;
function debug(content) {
    DEBUG_ENABLED && console.debug(`\x1b[37m✹ ${content}\x1b[0m`);
}
exports.debug = debug;
function cred(templateStrings, ...values) {
    let result = `\x1b[1;31m`;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    result += `\x1b[0m`;
    return result;
}
exports.cred = cred;
function cerr(templateStrings, ...values) {
    let result = `✗ `;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    return cred `${result}`;
}
exports.cerr = cerr;
function cgreen(templateStrings, ...values) {
    let result = `\x1b[1;32m`;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    result += `\x1b[0m`;
    return result;
}
exports.cgreen = cgreen;
function csucc(templateStrings, ...values) {
    let result = `✓ `;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    return cgreen `${result}`;
}
exports.csucc = csucc;

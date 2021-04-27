"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pad = exports.formatDuration = void 0;
function formatDuration(milliSeconds) {
    const seconds = Math.floor(milliSeconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${pad(minutes, 2)}m${pad(sec, 2)}s`;
}
exports.formatDuration = formatDuration;
function pad(number, digits) {
    let s = number.toString(10);
    while (s.length < digits) {
        s = `0${s}`;
    }
    return s;
}
exports.pad = pad;

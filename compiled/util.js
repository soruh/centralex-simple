"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function makePackageSkeleton(type, length = 0) {
    let buffer = Buffer.alloc(length + 2);
    buffer[0] = type;
    buffer[1] = length;
    return buffer;
}
exports.makePackageSkeleton = makePackageSkeleton;
function log(...args) {
    const timestamp = new Date(Date.now() + new Date().getTimezoneOffset() * (-60 * 1000))
        .toISOString()
        .replace('T', ' ')
        .slice(0, -1);
    if (typeof args[0] === "string") {
        args[0] = timestamp + ': ' + args[0];
    }
    else {
        args.unshift(timestamp + ':');
    }
    console.log(...args);
}
exports.log = log;

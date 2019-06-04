"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
Object.defineProperty(Buffer.prototype, "readNullTermString", {
    enumerable: false,
    value: function readNullTermString(encoding = "utf8", start = 0, end = this.length) {
        let firstZero = this.indexOf(0, start);
        let stop = firstZero >= start && firstZero <= end ? firstZero : end;
        return this.toString(encoding, start, stop);
    },
});
exports.default = Buffer;

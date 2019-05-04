"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
class ChunkPackages extends stream_1.Transform {
    constructor(options) {
        super(options);
        this.buffer = Buffer.alloc(0);
    }
    _transform(chunk, encoding, callback) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        let packageLength = (this.buffer[1] + 2) || Infinity;
        while (packageLength <= this.buffer.length) {
            this.push(this.buffer.slice(0, packageLength));
            this.buffer = this.buffer.slice(packageLength);
            packageLength = (this.buffer[1] + 2) || Infinity;
        }
        callback();
    }
}
exports.default = ChunkPackages;

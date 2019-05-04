"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
Buffer.prototype.readNullTermString =
    function readNullTermString(encoding = "utf8", start = 0, end = this.length) {
        let firstZero = this.indexOf(0, start);
        let stop = firstZero >= start && firstZero <= end ? firstZero : end;
        return this.toString(encoding, start, stop);
    };
const net = __importStar(require("net"));
const ChunkPackages_1 = __importDefault(require("./ChunkPackages"));
const config = {
    tlnServer: {
        host: "telexgateway.de",
        port: 11811,
    }
};
function decodeExt(ext) {
    if (ext === 0)
        return '';
    if (ext >= 1 && ext <= 99)
        return ext.toString().padStart(2, '0');
    if (ext === 100)
        return '00';
    if (ext > 100 && ext < 110)
        return ext.toString()[2];
    if (ext === 110)
        return '0';
    if (ext > 110 || ext < 0)
        return ''; // invalid
}
exports.decodeExt = decodeExt;
function encodeExt(ext) {
    if (!ext)
        return 0;
    if (isNaN(parseInt(ext)))
        return 0;
    if (ext === "0")
        return 110;
    if (ext === "00")
        return 100;
    if (ext.length === 1)
        return parseInt(ext) + 100;
    return parseInt(ext);
}
exports.encodeExt = encodeExt;
function makePackageSkeleton(type, length) {
    let buffer = Buffer.alloc(length + 2);
    buffer[0] = type;
    buffer[1] = length;
    return buffer;
}
function makeClientUpdatePackage(number, pin, port) {
    let buffer = makePackageSkeleton(1, 8);
    buffer.writeUIntLE(number, 2, 4);
    buffer.writeUIntLE(pin, 6, 2);
    buffer.writeUIntLE(port, 8, 2);
    return buffer;
}
function makePeerQueryPackage(number, version = 1) {
    let buffer = makePackageSkeleton(3, 5);
    buffer.writeUIntLE(number, 2, 4);
    buffer.writeUIntLE(version, 6, 1);
    return buffer;
}
function ipFromBuffer(buffer) {
    let ip = Array.from(buffer).join('.');
    if (ip === '0.0.0.0')
        return null;
    return ip;
}
function parsePeerReply(buffer) {
    let pkg = {
        number: buffer.readUIntLE(2, 4),
        name: buffer.readNullTermString("utf8", 6, 46),
        type: buffer.readUIntLE(48, 1),
        hostname: buffer.readNullTermString("utf8", 49, 89) || null,
        ipaddress: ipFromBuffer(buffer.slice(89, 93)),
        port: buffer.readUIntLE(93, 2),
        extension: buffer.readUIntLE(95, 1),
    };
    return pkg;
}
function peerQuery(number) {
    return new Promise((resolve, reject) => {
        let socket = new net.Socket();
        let chunker = new ChunkPackages_1.default();
        socket.pipe(chunker);
        socket.on('timeout', () => {
            reject(new Error('server timed out'));
        });
        socket.on('close', () => {
            reject(new Error('connection to server was closed'));
        });
        socket.on('error', err => {
            reject(new Error('could not connect to server'));
        });
        chunker.once('data', (data) => {
            socket.destroy();
            if (!data) {
                reject(new Error('no server result'));
            }
            else if (data[0] === 5) {
                resolve(parsePeerReply(data));
            }
            else if (data[0] === 4) {
                reject(new Error('not found'));
            }
            else {
                reject(new Error('invalid server result'));
            }
        });
        socket.connect(config.tlnServer, () => {
            socket.setTimeout(10 * 1000);
            socket.write(makePeerQueryPackage(number, 1));
        });
    });
}
exports.peerQuery = peerQuery;
function dynIpUpdate(number, pin, port) {
    return new Promise((resolve, reject) => {
        let socket = new net.Socket();
        let chunker = new ChunkPackages_1.default();
        socket.pipe(chunker);
        socket.on('timeout', () => {
            reject(new Error('server timed out'));
        });
        socket.on('close', () => {
            reject(new Error('connection to server was closed'));
        });
        chunker.once('data', (data) => {
            socket.destroy();
            if (!data) {
                return reject(new Error('no server result'));
            }
            if (data[0] === 2) {
                let address = ipFromBuffer(data.slice(2, 6));
                resolve(address);
            }
            else if (data[0] === 0xff) {
                reject(data.toString('utf8', 2));
            }
            else {
                reject(new Error('invalid server result'));
            }
        });
        socket.connect(config.tlnServer, () => {
            socket.setTimeout(10 * 1000);
            socket.write(makeClientUpdatePackage(number, pin, port));
        });
    });
}
exports.dynIpUpdate = dynIpUpdate;

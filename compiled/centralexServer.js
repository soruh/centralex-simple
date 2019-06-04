"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const util_1 = require("./util");
const Client_1 = __importDefault(require("./Client"));
const ChunkPackages_1 = __importDefault(require("./ChunkPackages"));
const constants_1 = require("./constants");
const globals_1 = require("./globals");
const centralexServer = new net_1.Server(socket => {
    const client = new Client_1.default(socket, true);
    util_1.log("new centralex client '%s' from ip %s", client.id, socket.remoteAddress);
    socket.on('error', (error) => {
        if (error.code === "ECONNRESET") {
            console.error("client " + client.id + " reset the socket");
        }
        else if (error.code === "EPIPE" || error.code === "ERR_STREAM_WRITE_AFTER_END") {
            console.error("tried to write data to " + client.id + " which is closed");
        }
        else {
            console.error('centralex socket error:', error);
            util_1.log("error code: ", error.code);
        }
    });
    socket.on('close', () => {
        util_1.log('centralex client %s disconnected', client.id);
    });
    client.enableCentralex();
    const chunker = new ChunkPackages_1.default();
    chunker.on('data', async (pkg) => {
        const [type, length] = pkg;
        const content = pkg.slice(2);
        switch (type) {
            case constants_1.PKG_END:
            // fall through to PKG_REJECT case
            // client.close();
            // break;
            case constants_1.PKG_REJECT:
                if (client.authenticated) {
                    const port = globals_1.ports.get(client.number);
                    if (port) {
                        const code = content.readNullTermString();
                        util_1.log("saving exit code \x1b[32m'%s'\x1b[0m for port \x1b[36m%i\x1b[0m", code, port);
                        globals_1.savedRejectCodes.set(port, code);
                    }
                }
                client.close();
                // log('client reject:', content.readNullTermString());
                break;
            case constants_1.PKG_REM_CONNECT:
                if (content.length >= 6) {
                    let number = content.readUInt32LE(0);
                    let pin = content.readUInt16LE(4);
                    if (globals_1.ports.has(number)) {
                        const port = globals_1.ports.get(number);
                        if (globals_1.clients.has(port)) {
                            const old_client = globals_1.clients.get(port);
                            if (old_client.occupied) {
                                client.send_reject("occ");
                                break;
                            }
                            else {
                                old_client.send_reject("occ");
                            }
                        }
                    }
                    client.call_callback('connect', number, pin);
                }
                break;
            case constants_1.PKG_REM_ACK:
                client.call_callback('callAccept');
                break;
        }
    });
    socket.pipe(chunker);
});
exports.default = centralexServer;

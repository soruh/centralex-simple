"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multiPortServer_1 = __importDefault(require("./multiPortServer"));
const Client_1 = __importDefault(require("./Client"));
const util_1 = require("./util");
const globals_1 = require("./globals");
const itelexServer = new multiPortServer_1.default(async (socket, port) => {
    const caller = new Client_1.default(socket, false);
    util_1.log("new centralex caller '%s' from ip %s", caller.id, socket.remoteAddress);
    socket.on('error', error => {
        socket.on('error', (error) => {
            if (error.code === "ECONNRESET") {
                console.error("client " + caller.id + " reset the socket");
            }
            else if (error.code === "EPIPE" || error.code === "ERR_STREAM_WRITE_AFTER_END") {
                console.error("tried to write data to " + caller.id + " which is closed");
            }
            else {
                console.error('itelex socket error:', require('util').inspect(error));
            }
        });
    });
    socket.on('close', error => {
        util_1.log('caller %s disconnected', caller.id);
    });
    if (!globals_1.clients.has(port)) {
        // client is not connected
        caller.send_reject(globals_1.savedRejectCodes.get(port) || 'nc');
        return;
    }
    caller.authenticated = true;
    // caller is unknown, but has to be set to authenticated
    // for calls to be allowed
    let called = globals_1.clients.get(port);
    if (!called.available) {
        // if a client is not available
        let errorMessage = 'nc';
        if (!called.authenticated) {
            errorMessage = 'na';
        }
        else if (called.occupied) {
            errorMessage = 'occ';
        }
        caller.send_reject(errorMessage);
        return;
    }
    const success = await called.centralex_call();
    if (!success) {
        caller.send_reject('occ');
        return;
    }
    const connected = called.connect(caller);
    if (!connected) {
        caller.send_reject('occ');
    }
});
exports.default = itelexServer;

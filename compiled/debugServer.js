"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("./globals");
const net_1 = require("net");
const itelexServer_1 = __importDefault(require("./itelexServer"));
function timeLeft(timeout) {
    let remaining = timeout["_idleTimeout"] + timeout["_idleStart"] - Math.floor(process.uptime() * 1000);
    if (remaining < 0)
        remaining = 0;
    return (remaining / 1000).toFixed(3);
}
function getStateProblems() {
    let openPorts = itelexServer_1.default.listPorts();
    let problems = [];
    for (let [port, client] of globals_1.clients) {
        if (globals_1.ports.find(value => value == port) === null) {
            problems.push(`client ${client._id} has no map to a number`);
        }
        if (globals_1.portTimeouts.has(port)) {
            problems.push(`port ${port} is connected to a client and in timeout at the same time`);
        }
    }
    for (let [number, port] of globals_1.ports) {
        if (!~openPorts.indexOf(port)) {
            problems.push(`port ${port} should be open, but is not`);
        }
        if (!(globals_1.clients.has(port) || globals_1.portTimeouts.has(port))) {
            problems.push(`port ${port} is used, but neither connected, nor in timeout`);
        }
    }
    for (let port of openPorts) {
        if (globals_1.ports.find((value, key) => value == port) === null) {
            problems.push(`port ${port} is open, but should not be`);
        }
        if (globals_1.ports.find(value => value == port) === null) {
            problems.push(`port ${port} is open, but should not be`);
        }
    }
    for (let [port, timeout] of globals_1.portTimeouts) {
        if (globals_1.clients.has(port)) {
            problems.push(`port ${port} is connected and in timeout at the same time`);
        }
        if (globals_1.ports.findIndex(value => value === port) === null) {
            problems.push(`port ${port} has a timeout, but not an associated number`);
        }
    }
    for (let [port, code] of globals_1.savedRejectCodes) {
        if (globals_1.ports.findIndex(value => value === port) === null) {
            problems.push(`port ${port} has a know reject code, but not an associated number`);
        }
    }
    return problems;
}
const debugServer = new net_1.Server(socket => {
    let message = "";
    message += "\n=> port-number mapping:\n";
    message += Array.from(globals_1.ports).sort((a, b) => a[1] - b[1]).map(x => `  - ${(x[0] + '').padStart(10)} on port: ${x[1]}`).join('\n');
    message += "\n\n=> connected clients:\n";
    // message += Array.from(clients).map(x => `  - ${(x[0] + '').padStart(10)} is a ${x[1].centralexEnabled ? 'centralex client' : 'caller'}`).join('\n');
    message += Array.from(globals_1.clients).sort((a, b) => a[0] - b[0]).map(x => `  - ${(x[1]._id + '').padStart(10)} on port: ${x[0]}${x[1].authenticated ? ' [authenticated]' : ' [unauthenticated]'}${x[1].occupied ? ' [occupied]' : ' [unoccupied]'}`).join('\n');
    message += "\n\n=> open ports:\n";
    message += itelexServer_1.default.listPorts().sort((a, b) => a - b).map(x => `  - ${(x + '').padStart(10)}`).join('\n');
    message += "\n\n=> port timeouts:\n";
    message += Array.from(globals_1.portTimeouts).sort((a, b) => a[0] - b[0]).map(x => `  - ${(x[0] + '').padStart(10)}: time to timeout: ${timeLeft(x[1])} seconds`).join('\n');
    message += "\n\n=> saved reject codes:\n";
    message += Array.from(globals_1.savedRejectCodes).sort((a, b) => a[0] - b[0]).map(x => `  - ${(x[0] + '').padStart(10)}: '${x[1]}'`).join('\n');
    // message += "\n\n=> constants:";
    // message += `\n  - AUTH_TIMEOUT: ${AUTH_TIMEOUT}`;
    // message += `\n  - CALL_ACK_TIMEOUT: ${CALL_ACK_TIMEOUT}`;
    // message += `\n  - PING_INTERVAL: ${PING_INTERVAL}`;
    // message += `\n  - TIMEOUT_DELAY: ${TIMEOUT_DELAY}`;
    // message += `\n  - PORT_TIMEOUT: ${PORT_TIMEOUT}`;
    message += "\n\n=> problems:\n";
    message += getStateProblems().map(x => '  - ' + x).join("\n");
    let header = "";
    header += `HTTP/1.0 200 OK\n`;
    header += `Content-Type: text/plain\n`;
    header += `Content-Length: ${Buffer.byteLength(message)}\n`;
    header += `Date: ${new Date().toUTCString()}\n`;
    socket.write(header);
    socket.write("\n");
    socket.end(message);
});
exports.default = debugServer;

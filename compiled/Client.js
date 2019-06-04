"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
const constants_1 = require("./constants");
const globals_1 = require("./globals");
const itelexServer_1 = __importDefault(require("./itelexServer"));
const ITelexServerCom_1 = require("./ITelexServerCom");
const util_2 = require("./util");
class Client {
    constructor(socket, centralex) {
        this.noCloseHandle = false;
        this.callbacks = {};
        this.number = null;
        this.centralexEnabled = false;
        this.socket = socket;
        this._id = require('crypto').randomBytes(3).toString('base64');
        this.idColor = centralex ? '\x1b[35m' : '\x1b[34m';
    }
    get id() {
        return this.idColor + this._id + '\x1b[0m';
    }
    get available() {
        // log(this.id + ': ' + ((this.authenticated && !this.occupied) ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m available');
        return this.authenticated && !this.occupied;
    }
    close() {
        this.socket.destroy();
        // let destroy = () => {
        //     destroy = () => { };
        //     this.socket.destroy();
        // }
        // this.socket.end(destroy);
        // setTimeout(destroy, 2000);
    }
    enableCentralex() {
        this.centralexEnabled = true;
        this.callbacks.connect = this.authenticate;
        this.socket.on('close', () => {
            this.clearAllTimeouts();
            clearInterval(this.ping);
        });
        this.restartTimeout();
        this.authTimeout = setTimeout(() => {
            util_1.log("client %s failed to authenticate itself in time", this.id);
            this.onTimeout();
        }, constants_1.AUTH_TIMEOUT);
        this.ping = setInterval(() => {
            this.write(Buffer.alloc(2));
        }, constants_1.PING_INTERVAL);
        this.socket.on('data', () => {
            this.restartTimeout();
        });
    }
    restartTimeout() {
        // log("restarted timeout for client %s", this.id);
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            util_1.log("client %s timed out", this.id);
            this.onTimeout();
        }, constants_1.TIMEOUT_DELAY);
    }
    onTimeout() {
        util_1.log("client " + this.id + " timed out");
        this.clearAllTimeouts();
        clearInterval(this.ping);
        if (this.peer) {
            this.peer.send_reject('der');
        }
        this.close();
    }
    clearAllTimeouts() {
        clearTimeout(this.timeout);
        clearTimeout(this.authTimeout);
    }
    async authenticate(number, pin) {
        util_1.log("client %s is trying to authenticate as \x1b[33m%d\x1b[0m", this.id, number);
        clearTimeout(this.authTimeout);
        let port = globals_1.ports.get(number);
        globals_1.savedRejectCodes.delete(port);
        if (port) {
            clearTimeout(globals_1.portTimeouts.get(port));
            globals_1.portTimeouts.delete(port);
        }
        if (!port) {
            port = await itelexServer_1.default.addFreePort();
        }
        if (!port) {
            this.socket.destroy();
            util_1.log('\x1b[31mfailed to open free port\x1b[0m');
            return;
        }
        globals_1.ports.set(number, port);
        util_1.log('\x1b[32madded\x1b[0m entry for client %s on port: \x1b[36m%i\x1b[0m', this.id, port);
        globals_1.clients.set(port, this);
        this.socket.once('close', () => {
            if (this.noCloseHandle)
                return;
            util_1.log('\x1b[31mremoved\x1b[0m entry for client %s on port: \x1b[36m%i\x1b[0m', this.id, port);
            globals_1.clients.delete(port);
            clearTimeout(globals_1.portTimeouts.get(port));
            globals_1.portTimeouts.set(port, setTimeout(() => {
                globals_1.savedRejectCodes.delete(port);
                const number = globals_1.ports.findIndex(value => value === port);
                globals_1.ports.delete(number);
                itelexServer_1.default.removePorts(port);
                globals_1.portTimeouts.delete(port);
            }, constants_1.PORT_TIMEOUT));
        });
        try {
            await ITelexServerCom_1.dynIpUpdate(number, pin, port);
            this.authenticated = true;
            const oldId = this.id;
            this.number = number;
            this._id = number.toString();
            this.idColor = '\x1b[33m';
            const newId = this.id;
            util_1.log("authenticated %s as %s", oldId, newId);
            this.send_centralex_confirm();
        }
        catch (err) {
            console.error('failed to update entry:', err);
            util_1.log("\x1b[31mpurging\x1b[0m all information on client %s", this.id);
            this.noCloseHandle = true; // don't call standart close handler
            // remove all client infomration on failed login
            globals_1.clients.delete(port);
            itelexServer_1.default.removePorts(port);
            globals_1.ports.delete(number);
            clearTimeout(globals_1.portTimeouts.get(port));
            globals_1.portTimeouts.delete(port);
            this.send_reject('na');
        }
    }
    call_callback(callback, ...args) {
        if (!this.callbacks.hasOwnProperty(callback))
            return false;
        this.callbacks[callback].apply(this, args);
        this.callbacks[callback] = null;
    }
    connect(client) {
        util_1.log('\x1b[1mconnecting\x1b[0m %s to %s', client.id, this.id);
        if (!(client.available && this.available)) {
            console.error('\x1b[31mfailed to connect\x1b[0m');
            // log(client.id + ': ' + (client.available ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m available');
            // log(client.id + ': ' + (client.occupied ? '\x1b[31mis' : '\x1b[32mnot') + '\x1b[0m occupied');
            // log(client.id + ': ' + (client.authenticated ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m authenticated');
            // log(this.id + ': ' + (this.available ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m available');
            // log(this.id + ': ' + (this.occupied ? '\x1b[31mis' : '\x1b[32mnot') + '\x1b[0m occupied');
            // log(this.id + ': ' + (this.authenticated ? '\x1b[32mis' : '\x1b[31mnot') + '\x1b[0m authenticated');
            return false;
        }
        clearTimeout(client.timeout);
        clearTimeout(this.timeout);
        clearInterval(client.ping);
        clearInterval(this.ping);
        client.occupied = true;
        this.occupied = true;
        client.peer = this;
        this.peer = client;
        client.socket.removeAllListeners('data');
        this.socket.removeAllListeners('data');
        client.socket.pipe(this.socket);
        this.socket.pipe(client.socket);
        this.socket.on('close', () => {
            // log(this.id + " socket closed");
            client.close();
        });
        client.socket.on('close', () => {
            // log(client.id + " socket closed");
            this.close();
        });
        return true;
    }
    write(buffer, end = false) {
        // if (!(buffer.length == 2 && buffer[0] == 0 && buffer[1] == 0)) {
        //     log('sent to ' + this.id + ': ', buffer);
        // }
        try {
            if (end) {
                this.socket.write(buffer);
                setTimeout(() => {
                    this.socket.end();
                }, 5 * 1000);
            }
            else {
                this.socket.write(buffer);
            }
            return true;
        }
        catch (err) {
            return false;
        }
    }
    centralex_call() {
        if (this.callbacks.callAccept)
            return false;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                resolve(false);
            }, constants_1.CALL_ACK_TIMEOUT);
            this.callbacks.callAccept = () => {
                clearTimeout(timeout);
                resolve(true);
            };
            this.send_centralex_call();
        });
    }
    send_reject(message) {
        message += '\0';
        let buffer = util_2.makePackageSkeleton(constants_1.PKG_REJECT, Buffer.byteLength(message, 'ascii'));
        buffer.write(message, 2, 'ascii');
        return this.write(buffer, true);
    }
    send_end() {
        const buffer = util_2.makePackageSkeleton(constants_1.PKG_END);
        return this.write(buffer, true);
    }
    send_centralex_confirm() {
        const buffer = util_2.makePackageSkeleton(constants_1.PKG_REM_CONFIRM);
        return this.write(buffer);
    }
    send_centralex_call() {
        const buffer = util_2.makePackageSkeleton(constants_1.PKG_REM_CALL);
        return this.write(buffer);
    }
}
exports.default = Client;

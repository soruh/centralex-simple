"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const net = __importStar(require("net"));
const events_1 = require("events");
class MultiPortServer extends events_1.EventEmitter {
    constructor(callback, ports) {
        super();
        this.applyPreListen = [];
        this.servers = new Map();
        this.listen = this.addPorts;
        this.on('connection', callback);
        this.target = new Set(ports ? ports : null);
        this.updateRunning();
    }
    updateRunning() {
        let changes = {};
        for (let port of this.target) {
            changes[port] = {
                started: null,
                running: null,
                terminated: false,
            };
            if (this.servers.has(port)) {
                changes[port].started = false;
                changes[port].running = true;
            }
            else {
                changes[port].started = true;
                let server = new net.Server(socket => this.emit('connection', socket, port));
                server.on('error', (error) => {
                    this.emit('error', error, port);
                });
                for (let callback of this.applyPreListen) {
                    callback(server);
                }
                try {
                    server.listen(port);
                    this.emit('listening', port);
                    changes[port].running = true;
                }
                catch (e) {
                    changes[port].running = false;
                }
                this.servers.set(port, server);
            }
        }
        for (let [port, server] of this.servers) {
            if (!this.target.has(port)) {
                server.close();
                this.emit('close', port);
                this.servers.delete(port);
                changes[port] = {
                    started: false,
                    running: false,
                    terminated: true,
                };
            }
        }
        return this; // chaining
        // return changes; //more information
    }
    addFreePort() {
        return new Promise((resolve, reject) => {
            let port = null;
            let server = new net.Server(socket => this.emit('connection', socket, port));
            for (let callback of this.applyPreListen)
                callback(server);
            server.listen(0, () => {
                port = (server.address() || { port: null }).port || null;
                this.emit('listening', port);
                this.target.add(port);
                this.servers.set(port, server);
                resolve(port);
            });
        });
    }
    addPorts(ports) {
        if (!(ports instanceof Array))
            ports = [ports];
        for (let port of ports)
            this.target.add(port);
        return this.updateRunning();
    }
    removePorts(ports) {
        if (!(ports instanceof Array))
            ports = [ports];
        for (let port of ports)
            this.target.delete(port);
        return this.updateRunning();
    }
    listPorts() {
        return Array.from(this.target.keys());
    }
    getServerByPort(port) {
        return this.servers.get(port);
    }
    assignHandler(applier, applyBeforeListen = true) {
        if (applyBeforeListen)
            this.applyPreListen.push(applier);
        for (let [, server] of this.servers) {
            applier(server);
        }
        return this;
    }
    close() {
        this.target = new Set();
        return this.updateRunning();
    }
}
exports.default = MultiPortServer;

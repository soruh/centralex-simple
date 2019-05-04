import * as net from "net";
import { EventEmitter } from "events";

class MultiPortServer extends EventEmitter{
	private target: Set<number>;
	private applyPreListen: Array<(server: net.Server) => void> = [];
	public servers: Map<number, net.Server> = new Map();
	constructor(callback: (connection: net.Socket, port?: number) => void, ports?: number[]) {
		super();

		this.on('connection', callback);
		this.target = new Set(ports ? ports : null);
		this.updateRunning();
	}
	private updateRunning() {
		let changes: {
			[index: string]: {
				started: boolean,
				terminated: boolean,
				running: boolean,
			},
		} = {};
		for (let port of this.target) {
			changes[port] = {
				started: null,
				running: null,
				terminated: false,
			};
			if (this.servers.has(port)) {
				changes[port].started = false;
				changes[port].running = true;
			} else {
				changes[port].started = true;

				let server = new net.Server(socket => this.emit('connection', socket, port));

				server.on('error', (error)=>{
					this.emit('error', error, port);
				});

				for (let callback of this.applyPreListen){
					callback(server);
				}

				try {
					server.listen(port);
					this.emit('listening', port);
					changes[port].running = true;
				} catch (e) {
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
	public addFreePort():Promise<number>{
		return new Promise((resolve, reject) => {
			let port: number = null;
			let server = new net.Server(socket => this.emit('connection', socket, port));
			for (let callback of this.applyPreListen) callback(server);
			
			server.listen(0, () => {
				port = (server.address() as net.AddressInfo || { port: null }).port || null;
				
				this.emit('listening', port);
				
				this.target.add(port);
				this.servers.set(port, server);

				resolve(port);
			});
		});
	}
	public addPorts(ports: number[]) {
		if (!(ports instanceof Array)) ports = [ports];
		
		for (let port of ports) this.target.add(port);
		
		return this.updateRunning();
	}
	public listen = this.addPorts;
	public removePorts(ports: number|number[]) {
		if (!(ports instanceof Array)) ports = [ports];

		for (let port of ports) this.target.delete(port);

		return this.updateRunning();
	}
	public listPorts() {
		return Array.from(this.target.keys());
	}
	public getServerByPort(port: number) {
		return this.servers.get(port);
	}
	public assignHandler(applier: (server: net.Server) => void, applyBeforeListen=true) {
		if (applyBeforeListen) this.applyPreListen.push(applier);
		for (let [, server] of this.servers) {
			applier(server);
		}
		return this;
	}

	public close(){
		this.target = new Set();

		return this.updateRunning();
	}
}

export default MultiPortServer;
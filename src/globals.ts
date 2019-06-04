import Client from "./Client";

let clients: Map<Port, Client> = new Map();
let ports: Map<CallNumber, Port> = new Map();
let portTimeouts: Map<Port, NodeJS.Timer> = new Map();
let savedRejectCodes: Map<Port, string> = new Map();



export {
    clients,
    ports,
    portTimeouts,
    savedRejectCodes,
};

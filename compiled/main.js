"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./prototypes/Buffer");
require("./prototypes/Map");
const itelexServer_1 = __importDefault(require("./itelexServer"));
const centralexServer_1 = __importDefault(require("./centralexServer"));
const debugServer_1 = __importDefault(require("./debugServer"));
const util_1 = require("./util");
itelexServer_1.default.on('close', (port) => {
    util_1.log('\x1b[31mclosed\x1b[0m port: \x1b[36m%i\x1b[0m', port);
});
centralexServer_1.default.listen(49491, () => {
    util_1.log("centralex server listening on port %d", 49491);
});
debugServer_1.default.listen(4885, () => {
    util_1.log("debug server listening on port %d", 4885);
});

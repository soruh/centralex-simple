"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PKG_END = 0x03;
exports.PKG_END = PKG_END;
const PKG_REJECT = 0x04;
exports.PKG_REJECT = PKG_REJECT;
const PKG_REM_CONNECT = 0x81;
exports.PKG_REM_CONNECT = PKG_REM_CONNECT;
const PKG_REM_CONFIRM = 0x82;
exports.PKG_REM_CONFIRM = PKG_REM_CONFIRM;
const PKG_REM_CALL = 0x83;
exports.PKG_REM_CALL = PKG_REM_CALL;
const PKG_REM_ACK = 0x84;
exports.PKG_REM_ACK = PKG_REM_ACK;
const AUTH_TIMEOUT = 30 * 1000;
exports.AUTH_TIMEOUT = AUTH_TIMEOUT;
const CALL_ACK_TIMEOUT = 30 * 1000;
exports.CALL_ACK_TIMEOUT = CALL_ACK_TIMEOUT;
const PING_INTERVAL = 15 * 1000;
exports.PING_INTERVAL = PING_INTERVAL;
const TIMEOUT_DELAY = 35 * 1000;
exports.TIMEOUT_DELAY = TIMEOUT_DELAY;
const PORT_TIMEOUT = 60 * 60 * 1000;
exports.PORT_TIMEOUT = PORT_TIMEOUT;

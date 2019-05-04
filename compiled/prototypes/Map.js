"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
Object.defineProperty(Map.prototype, "find", {
    enumerable: false,
    value: function find(predicate) {
        for (let [key, value] of this) {
            if (predicate(value, key, this)) {
                return value;
            }
        }
        return null;
    }
});
Object.defineProperty(Map.prototype, "findIndex", {
    enumerable: false,
    value: function findIndex(predicate) {
        for (let [key, value] of this) {
            if (predicate(value, key, this)) {
                return key;
            }
        }
        return null;
    }
});
exports.default = Map;

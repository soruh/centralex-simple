declare global {
    interface Map<K, V> {
        find: (predicate: (value: V, key: K, map: this) => boolean) => V;
        findIndex: (predicate: (value: V, key: K, map: this) => boolean) => K;
    }
}
Object.defineProperty(Map.prototype, "find", {
    enumerable: false,
    value: function find<K, V>(predicate: (value?: V, key?: K, map?: Map<K, V>) => boolean): V {
        for (let [key, value] of this as Map<K, V>) {
            if (predicate(value, key, this)) {
                return value;
            }
        }
        return null;
    }
});
Object.defineProperty(Map.prototype, "findIndex", {
    enumerable: false,
    value: function findIndex<K, V>(predicate: (value?: V, key?: K, map?: Map<K, V>) => boolean): K {
        for (let [key, value] of this as Map<K, V>) {
            if (predicate(value, key, this)) {
                return key;
            }
        }
        return null;
    }
});

export default Map;

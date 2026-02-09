import { AdjacentStation } from "./types";

// Custom Hash Table implementation that stores values based on stationId and lineId keys 
export class HashTable<K extends AdjacentStation, V> {
    // Internal Map to store key-value pairs
    // Keys are stringified versions of stationId and lineId
    // Values are of generic type V
    private table: Map<string, V>;

    // Initializes internal map
    constructor() {
        this.table = new Map<string, V>();
    }

    // Stringifies key by combining stationId and lineId
    private makeKeyString(key: K): string {
        const keyString = `${key.stationId}-${key.lineId}`;
        return keyString;
    }

    // Adds stringified key-value pair to internal map
    public set(key: K, value: V) {
        this.table.set(this.makeKeyString(key), value);
    }

    // Checks if stringified key exists in the internal map
    public has(key: K): boolean {
        return this.table.has(this.makeKeyString(key));
    }

    // Retrieves value based on stringified key
    public get(key: K): V | undefined {
        return this.table.get(this.makeKeyString(key));
    }

    // Returns the number of key-value pairs stored in the internal map
    public size(): number {
        return this.table.size;
    }
}
import { adjacentStation } from "./types";

export class HashMap<K extends adjacentStation, V> {
    private table: Map<string, V>;

    constructor() {
        this.table = new Map<string, V>();
    }

    private makeKeyString(key: K): string {
        const keyString = `${key.stationId}-${key.lineId}`;
        return keyString;
    }

    public set(key: K, value: V) {
        this.table.set(this.makeKeyString(key), value);
    }

    public has(key: K): boolean {
        return this.table.has(this.makeKeyString(key));
    }

    public get(key: K): V | undefined {
        return this.table.get(this.makeKeyString(key));
    }

    public size(): number {
        return this.table.size;
    }
}
import { adjacentStation } from "./types";

export class StationSet<K extends adjacentStation> {
    private stationLineKeys: Set<string>;

    constructor() {
        this.stationLineKeys = new Set<string>();
    }

    private makeKeyString(key: K): string {
        const keyString = `${key.stationId}-${key.lineId}`;
        return keyString;
    }

    public add(key: K) {
        this.stationLineKeys.add(this.makeKeyString(key));
    }
    public has(key: K): boolean {
        return this.stationLineKeys.has(this.makeKeyString(key));
    }

    public size(): number {
        return this.stationLineKeys.size;
    }
}
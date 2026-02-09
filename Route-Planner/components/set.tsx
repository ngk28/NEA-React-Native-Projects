import { AdjacentStation } from "./types";

// Custom Set implementation that stores stationId and lineId combinations to track visited stations
export class VisitedStationSet<K extends AdjacentStation> {
    // Internal Set to store stringified stationId and lineId combinations
    // Keys are stringified versions of stationId and lineId
    private stationLineKeys: Set<string>;

    // Initializes internal set
    constructor() {
        this.stationLineKeys = new Set<string>();
    }

    // Stringifies key by combining stationId and lineId
    private makeKeyString(key: K): string {
        const keyString = `${key.stationId}-${key.lineId}`;
        return keyString;
    }

    // Adds stringified key to internal set
    public add(key: K) {
        this.stationLineKeys.add(this.makeKeyString(key));
    }

    // Checks if stringified key exists in the internal set
    public has(key: K): boolean {
        return this.stationLineKeys.has(this.makeKeyString(key));
    }

    // Returns the number of unique keys stored in the internal set
    public size(): number {
        return this.stationLineKeys.size;
    }
}
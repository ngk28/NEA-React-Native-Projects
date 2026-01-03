import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

let databaseInstance: SQLite.SQLiteDatabase | null = null;

export interface Database {
    open(): Promise<SQLite.SQLiteDatabase>;
    retrieveNeighbourStations(stationId: number): Promise<Array<{ toStationId: number; lineId: number; travelTime: number }>>;
    countStations(): Promise<number>;
    retrieveStationCoordinate(stationId: number): Promise<[number, number]>;
    retrieveStationName(stationId: number): Promise<string>;
    retrieveTransferTime(fromStationId: number, toStationId: number, lineId: number): Promise<number>;
}

export const Database: Database = {
    open,
    retrieveNeighbourStations: retrieveNeighbourStations,
    countStations: countNumberOfStations,
    retrieveStationCoordinate: retrieveStationCoordinate,
    retrieveStationName: retrieveStationName,
    retrieveTransferTime: retrieveTransferTime,
};

async function retrieveStationCoordinate(stationId: number): Promise<[number, number]> {
    const command = `
        SELECT latitude, longitude 
        FROM stations
        WHERE stationId = ?; 
        `;
    const db = await open();
    try {
        const [result] = await db.executeSql(command, [stationId]);
        if (result.rows.length > 0) {
            const row = result.rows.item(0);
            return [row.latitude, row.longitude];
        } else {
            throw new Error(`Station with ID ${stationId} not found.`);
        }
    } catch (err) {
        console.error('Error retrieving station coordinates:', err);
        throw err;
    }
}


async function open(): Promise<SQLite.SQLiteDatabase> {
    if (databaseInstance) return databaseInstance;
    try {
        const db = await SQLite.openDatabase({ name: 'LondonUndergroundTestV5.db', createFromLocation: 1, readOnly: true });
        databaseInstance = db;
        return db;
    } catch (err) {
        console.error('Error opening database:', err);
        throw err;
    }
}

async function countNumberOfStations(): Promise<number> {
    const command = `SELECT COUNT(*) as count FROM stations`;
    const db = await open();
    try {
        const [result] = await db.executeSql(command);
        const count = result.rows.item(0).count;
        return Number(count);
    } catch (err) {
        console.error('Error counting stations:', err);
        throw err;
    }
}

async function retrieveStationName(stationId: number): Promise<string> {
    const command = `
        SELECT stationName
        FROM stations
        WHERE stationId = ?; 
        `;
    const db = await open();
    try {
        const [result] = await db.executeSql(command, [stationId]);
        if (result.rows.length > 0) {
            const row = result.rows.item(0);
            return row.stationName;
        } else {
            throw new Error(`Station with ID ${stationId} not found.`);
        }
    } catch (err) {
        console.error('Error retrieving station name:', err);
        throw err;
    }
}

async function retrieveNeighbourStations(stationId: number): Promise<Array<{ toStationId: number; lineId: number; travelTime: number }>> {
    // Left join to connect databases
    const command = `
        SELECT connections.toStationId, lines.lineId AS lineId, connections.travelTime
        FROM connections
        LEFT JOIN lines ON connections.lineId = lines.lineId
        WHERE connections.fromStationId = ?
        `;

    const db = await open();
    try {
        const [result] = await db.executeSql(command, [stationId]);
        const stations: Array<{ toStationId: number; lineId: number; travelTime: number }> = [];
        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            stations.push({ toStationId: row.toStationId, lineId: row.lineId, travelTime: row.travelTime });
        }
        return stations;
    } catch (err) {
        console.error('Error retrieving neighbour stations:', err);
        throw err;
    }
}

async function retrieveTransferTime(stationId: number, fromLineId: number | null, toLineId: number): Promise<number> {
    // If we are starting a journey (no incoming line), there is no transfer time.
    if (fromLineId === null) return 0;

    const DEFAULT_TRANSFER_PENALTY = 4; // minutes

    const db = await open();

    // Try one way first (fromLineId -> toLineId)
    const directQuery = `
        SELECT transferTime
        FROM transfers
        WHERE stationId = ? AND fromLineId = ? AND toLineId = ?;
    `;
    // Try other way (toLineId -> fromLineId)
    const symmetricQuery = `
        SELECT transferTime
        FROM transfers
        WHERE stationId = ? AND fromLineId = ? AND toLineId = ?;
    `;
    try {
        const [res1] = await db.executeSql(directQuery, [stationId, fromLineId, toLineId]);
        if (res1.rows.length > 0) {
            const row = res1.rows.item(0);
            return Number(row.transferTime);
        }
        const [res2] = await db.executeSql(symmetricQuery, [stationId, toLineId, fromLineId]);
        if (res2.rows.length > 0) {
            const row = res2.rows.item(0);
            return Number(row.transferTime);
        }
        console.warn(`No transfer time found for stationId ${stationId} between lines ${fromLineId} and ${toLineId}. Using default penalty.`);
        return DEFAULT_TRANSFER_PENALTY;
    } catch (err) {
        console.error('Error retrieving transfer time:', err);
        return DEFAULT_TRANSFER_PENALTY;
    }
}
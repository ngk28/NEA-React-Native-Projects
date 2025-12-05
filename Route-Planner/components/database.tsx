import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

let databaseInstance: SQLite.SQLiteDatabase | null = null;

export interface Database {
    open(): Promise<SQLite.SQLiteDatabase>;
    retrieveNeighbourStations(stationId: number): Promise<Array<{ toStationId: number; lineId: number; travelTime: number }>>;
    countStations(): Promise<number>;
    retrieveStationCoordinate(stationId: number): Promise<[number, number]>;
    retrieveStationName(stationId: number): Promise<string>;
}

export const Database: Database = {
    open,
    retrieveNeighbourStations: retrieveNeighbourStations,
    countStations: countNumberOfStations,
    retrieveStationCoordinate: retrieveStationCoordinate,
    retrieveStationName: retrieveStationName,
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
        const db = await SQLite.openDatabase({ name: 'LondonUndergroundTestV4.db', createFromLocation: 1, readOnly: true });
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

async function retrieveConnectionTime(fromStationId: number, toStationId: number, lineId: number): Promise<number> {
    const command = `
        SELECT travelTime
        FROM connections
        WHERE fromStationId = ? AND toStationId = ? AND lineId = ?;
        `;
    const db = await open();
    try {
        const [result] = await db.executeSql(command, [fromStationId, toStationId, lineId]);
        if (result.rows.length > 0) {
            const row = result.rows.item(0);
            return row.travelTime;
        }
        else {
            throw new Error(`Connection from station ${fromStationId} to station ${toStationId} not found.`);
        }
    } catch (err) {
        console.error('Error retrieving connection time:', err);
        throw err;
    }
}

async function retrieveNeighbourStations(stationId: number): Promise<Array<{ toStationId: number; lineId: number; travelTime: number }>> {
    // LEFT JOIN to get line information
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
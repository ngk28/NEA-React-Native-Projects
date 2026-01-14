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
    retrieveStationsByName(searchTerm: string): Promise<Array<{ stationId: number; stationName: string }>>;
    retrieveLineName(lineId: number): Promise<string>;
    retrieveNaptanId(stationId: number): Promise<string>;
    retrieveLineId(lineName: string): Promise<number>;
}

export const Database: Database = {
    open,
    retrieveNeighbourStations: retrieveNeighbourStations,
    countStations: countNumberOfStations,
    retrieveStationCoordinate: retrieveStationCoordinate,
    retrieveStationName: retrieveStationName,
    retrieveTransferTime: retrieveTransferTime,
    retrieveStationsByName: retrieveStationsByName,
    retrieveLineName: retrieveLineName,
    retrieveNaptanId: retrieveNaptanId,
    retrieveLineId: retrieveLineId,
};

async function retrieveStationCoordinate(stationId: number): Promise<[number, number]> {
    const command = `
        SELECT latitude, longitude 
        FROM stations
        WHERE stationId = ?; 
        `;
    const db = await open();
    try {
        const [response] = await db.executeSql(command, [stationId]);
        const result = response.rows;
        if (result.length > 0) {
            const coordinate = result.item(0);
            return [coordinate.longitude, coordinate.latitude];
        } else {
            throw new Error(`Station with ID ${stationId} not found.`);
        }
    } catch (error) {
        console.error('Error retrieving station coordinates:', error);
        throw error;
    }
}
async function retrieveLineId(lineName: string): Promise<number> {
    const command = `
        SELECT lineId
        FROM lines
        WHERE lineName = ?;
    `;
    const db = await open();
    try {
        const [response] = await db.executeSql(command, [lineName]);
        const result = response.rows;
        if (result.length > 0) {
            const lineId = result.item(0).lineId;
            return lineId;
        } else {
            throw new Error(`Line with name ${lineName} not found.`);
        }
    } catch (error) {
        console.error('Error retrieving line ID:', error);
        throw error;
    }
}
async function open(): Promise<SQLite.SQLiteDatabase> {
    if (databaseInstance) return databaseInstance;
    try {
        const db = await SQLite.openDatabase({ name: 'LondonUndergroundTestV8.db', createFromLocation: 1, readOnly: true });
        databaseInstance = db;
        return db;
    } catch (error) {
        console.error('Error opening database:', error);
        throw error;
    }
}

async function retrieveNaptanId(stationId: number): Promise<string> {
    const command = `
        SELECT naptanId
        FROM stations
        WHERE stationId = ?;
    `;
    const db = await open();
    try {
        const [response] = await db.executeSql(command, [stationId]);
        const result = response.rows;
        if (result.length > 0) {
            return result.item(0).naptanId;
        } else {
            throw new Error(`Station with ID ${stationId} not found.`);
        }
    } catch (error) {
        console.error('Error retrieving Naptan ID:', error);
        throw error;
    }
}

async function countNumberOfStations(): Promise<number> {
    const command = `SELECT COUNT(*) as count FROM stations`;
    const db = await open();
    try {
        const [result] = await db.executeSql(command);
        const count = result.rows.item(0).count;
        return Number(count);
    } catch (error) {
        console.error('Error counting stations:', error);
        throw error;
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
        const [response] = await db.executeSql(command, [stationId]);
        const result = response.rows;
        if (result.length > 0) {
            return result.item(0).stationName;
        } else {
            throw new Error(`Station with ID ${stationId} not found.`);
        }
    } catch (error) {
        console.error('Error retrieving station name:', error);
        throw error;
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
        const [response] = await db.executeSql(command, [stationId]);
        const result = response.rows;
        const stations: Array<{ toStationId: number; lineId: number; travelTime: number }> = [];
        for (let i = 0; i < result.length; i++) {
            const row = result.item(i);
            stations.push({ toStationId: row.toStationId, lineId: row.lineId, travelTime: row.travelTime });
        }
        return stations;
    } catch (error) {
        console.error('Error retrieving neighbour stations:', error);
        throw error;
    }
}

async function retrieveTransferTime(stationId: number, fromLineId: number | null, toLineId: number): Promise<number> {
    // If starting a journey (no incoming line), there is no transfer time
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
    const reverseQuery = `
        SELECT transferTime
        FROM transfers
        WHERE stationId = ? AND fromLineId = ? AND toLineId = ?;
    `;
    try {
        const [result1] = await db.executeSql(directQuery, [stationId, fromLineId, toLineId]);
        if (result1.rows.length > 0) {
            const row = result1.rows.item(0);
            return Number(row.transferTime);
        }
        const [result2] = await db.executeSql(reverseQuery, [stationId, toLineId, fromLineId]);
        if (result2.rows.length > 0) {
            const row = result2.rows.item(0);
            return Number(row.transferTime);
        }
        console.warn(`No transfer time found for stationId ${stationId} between lines ${fromLineId} and ${toLineId}. Using default penalty.`);
        return DEFAULT_TRANSFER_PENALTY;
    } catch (error) {
        console.error('Error retrieving transfer time:', error);
        return DEFAULT_TRANSFER_PENALTY;
    }
}
async function retrieveLineName(lineId: number): Promise<string> {
    const command = `
        SELECT lineName
        FROM lines
        WHERE lineId = ?;
    `;
    const db = await open();
    try {
        const [result] = await db.executeSql(command, [lineId]);
        if (result.rows.length > 0) {
            const row = result.rows.item(0);
            return row.lineName;
        } else {
            throw new Error(`Line with ID ${lineId} not found.`);
        }
    } catch (error) {
        console.error('Error retrieving line name:', error);
        throw error;
    }
}

async function retrieveStationsByName(searchTerm: string): Promise<Array<{ stationId: number; stationName: string }>> {
    const command = `
        SELECT stationId, stationName
        FROM stations
        WHERE stationName LIKE ?
        ORDER BY stationName ASC
    `;

    const db = await open();
    try {
        const [response] = await db.executeSql(command, [`${searchTerm}%`]);
        const result = response.rows;
        const stations: Array<{ stationId: number; stationName: string }> = [];
        for (let i = 0; i < result.length; i++) {
            const row = result.item(i);
            stations.push({ stationId: row.stationId, stationName: row.stationName });
        }
        return stations;
    } catch (error) {
        console.error('Error retrieving stations by name:', error);
        throw error;
    }
}
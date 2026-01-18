import SQLite from 'react-native-sqlite-storage';
import { adjacentStation, coordinate, station } from './types';

SQLite.enablePromise(true);

let databaseInstance: SQLite.SQLiteDatabase | null = null;
const DEFAULT_TRANSFER_PENALTY_IN_MINUTES = 4;
const FILE_NAME = 'tubeInformation.db'

export interface tubeDatabase {
    openDatabase(): Promise<SQLite.SQLiteDatabase>;
    retrieveStationName(stationId: number): Promise<string>;
    retrieveStationCoordinate(stationId: number): Promise<coordinate>;
    retrieveNaptanId(stationId: number): Promise<string>;
    retrieveStationSuggestions(searchTerm: string): Promise<Array<station>>;
    retrieveLineId(lineName: string): Promise<number>;
    retrieveLineName(lineId: number): Promise<string>;
    retrieveTransferTime(fromStationId: number, toStationId: number, lineId: number): Promise<number>;
    retrieveNeighbourStations(stationId: number): Promise<Array<adjacentStation>>;
}

export const tubeDatabase: tubeDatabase = {
    openDatabase: openDatabase,
    retrieveStationName: retrieveStationName,
    retrieveStationCoordinate: retrieveStationCoordinate,
    retrieveNaptanId: retrieveNaptanId,
    retrieveStationSuggestions: retrieveStationSuggestions,
    retrieveLineId: retrieveLineId,
    retrieveLineName: retrieveLineName,
    retrieveTransferTime: retrieveTransferTime,
    retrieveNeighbourStations: retrieveNeighbourStations,
};

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (databaseInstance) return databaseInstance;
    try {
        const db = await SQLite.openDatabase({ name: FILE_NAME, createFromLocation: 1, readOnly: true });
        databaseInstance = db;
        return db;
    } catch (error) {
        console.error('Error opening database:', error);
        throw error;
    }
}

async function retrieveStationName(stationId: number): Promise<string> {
    const command = `
        SELECT stationName
        FROM stations
        WHERE stationId = ?; 
        `;
    const db = await openDatabase();
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

async function retrieveStationCoordinate(stationId: number): Promise<coordinate> {
    const command = `
        SELECT latitude, longitude 
        FROM stations
        WHERE stationId = ?; 
        `;
    const db = await openDatabase();
    try {
        const [response] = await db.executeSql(command, [stationId]);
        const result = response.rows;
        if (result.length > 0) {
            const coordinate: coordinate = {
                latitude: result.item(0).latitude,
                longitude: result.item(0).longitude,
            };
            return coordinate;
        } else {
            throw new Error(`Station with ID ${stationId} not found.`);
        }
    } catch (error) {
        console.error('Error retrieving station coordinates:', error);
        throw error;
    }
}

async function retrieveNaptanId(stationId: number): Promise<string> {
    const command = `
        SELECT naptanId
        FROM stations
        WHERE stationId = ?;
    `;
    const db = await openDatabase();
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

async function retrieveStationSuggestions(searchTerm: string): Promise<Array<station>> {
    const command = `
        SELECT stationId, stationName
        FROM stations
        WHERE stationName LIKE ?
        ORDER BY stationName ASC
    `;
    const db = await openDatabase();
    try {
        const [response] = await db.executeSql(command, [`${searchTerm}%`]);
        const result = response.rows;
        const stations: Array<station> = [];
        for (let i = 0; i < result.length; i++) {
            const row = result.item(i);
            const station = {
                id: row.stationId,
                name: row.stationName
            };
            stations.push(station);
        }
        return stations;
    } catch (error) {
        console.error('Error retrieving stations suggestions:', error);
        throw error;
    }
}

async function retrieveLineId(lineName: string): Promise<number> {
    const command = `
        SELECT lineId
        FROM lines
        WHERE lineName = ?;
    `;
    const db = await openDatabase();
    try {
        const [response] = await db.executeSql(command, [lineName]);
        const result = response.rows;
        if (result.length > 0) {
            return result.item(0).lineId;
        } else {
            throw new Error(`Line with name ${lineName} not found.`);
        }
    } catch (error) {
        console.error('Error retrieving line ID:', error);
        throw error;
    }
}

async function retrieveLineName(lineId: number): Promise<string> {
    const command = `
        SELECT lineName
        FROM lines
        WHERE lineId = ?;
    `;
    const db = await openDatabase();
    try {
        const [response] = await db.executeSql(command, [lineId]);
        const result = response.rows;
        if (result.length > 0) {
            return result.item(0).lineName;
        } else {
            throw new Error(`Line with ID ${lineId} not found.`);
        }
    } catch (error) {
        console.error('Error retrieving line name:', error);
        throw error;
    }
}

async function retrieveNeighbourStations(stationId: number): Promise<Array<adjacentStation>> {
    const command = `
        SELECT toStationId, lineId, travelTime
        FROM connections
        WHERE connections.fromStationId = ?
    `;
    const db = await openDatabase();
    try {
        const [response] = await db.executeSql(command, [stationId]);
        const result = response.rows;
        const neighbourStations: Array<adjacentStation> = [];
        for (let i = 0; i < result.length; i++) {
            const row = result.item(i);
            const neighbourStation: adjacentStation = {
                stationId: row.toStationId,
                lineId: row.lineId,
                travelTime: row.travelTime
            };
            neighbourStations.push(neighbourStation);
        }
        return neighbourStations;
    } catch (error) {
        console.error('Error retrieving neighbour stations:', error);
        throw error;
    }
}

async function retrieveTransferTime(stationId: number, fromLineId: number, toLineId: number): Promise<number> {
    // If starting a journey (no incoming line), there is no transfer time
    // Try one way first: fromLineId -> toLineId
    const directQuery = `
        SELECT transferTime
        FROM transfers
        WHERE stationId = ? AND fromLineId = ? AND toLineId = ?;
    `;
    // Try other way: toLineId -> fromLineId
    const reverseQuery = `
        SELECT transferTime
        FROM transfers
        WHERE stationId = ? AND fromLineId = ? AND toLineId = ?;
    `;
    const db = await openDatabase();
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
        console.warn(`No transfer time for ${stationId} between ${fromLineId} and ${toLineId}. Using default penalty.`);
        return DEFAULT_TRANSFER_PENALTY_IN_MINUTES;
    } catch (error) {
        console.error('Error retrieving transfer time:', error);
        return DEFAULT_TRANSFER_PENALTY_IN_MINUTES;
    }
}
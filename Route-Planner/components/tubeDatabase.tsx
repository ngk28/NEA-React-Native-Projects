import SQLite from 'react-native-sqlite-storage';
import { AdjacentStation, Coordinate, Station } from './types';

// Enables promise-based API for database operations
SQLite.enablePromise(true);
const FILE_NAME = 'tubeInformation.db';

// Restricts database to a single instance
let databaseInstance: SQLite.SQLiteDatabase | null = null;

// Interface for TubeDatabase
export interface TubeDatabase {
    openDatabase(): Promise<SQLite.SQLiteDatabase>;
    retrieveStationName(stationId: number): Promise<string>;
    retrieveStationCoordinate(stationId: number): Promise<Coordinate>;
    retrieveNaptanId(stationId: number): Promise<string>;
    retrieveStationSuggestions(searchTerm: string): Promise<Array<Station>>;
    retrieveLineId(lineName: string): Promise<number>;
    retrieveLineName(lineId: number): Promise<string>;
    retrieveTransferTime(fromStationId: number, toStationId: number, lineId: number): Promise<number>;
    retrieveNeighbourStations(stationId: number): Promise<Array<AdjacentStation>>;
    retrieveNeighbourStationsDebug(stationName: string): Promise<void>;
}

export const tubeDatabase: TubeDatabase = {
    openDatabase,
    retrieveStationName,
    retrieveStationCoordinate,
    retrieveNaptanId,
    retrieveStationSuggestions,
    retrieveLineId,
    retrieveLineName,
    retrieveTransferTime,
    retrieveNeighbourStations,
    retrieveNeighbourStationsDebug: retrieveNeighbourStationsToView,
};

// Function that opens database, ensures only one instance is created
async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (databaseInstance) {
        return databaseInstance;
    }

    try {
        const database = await SQLite.openDatabase({ name: FILE_NAME, createFromLocation: 1, readOnly: true });
        databaseInstance = database;
        return database;
    } catch (error) {
        console.error('Error opening database:', error);
        throw error;
    }
}

// Function that retrieves station name from station ID
async function retrieveStationName(stationId: number): Promise<string> {
    const command = `
        SELECT stationName
        FROM stations
        WHERE stationId = ?; 
    `;
    const database = await openDatabase();
    try {
        const [response] = await database.executeSql(command, [stationId]);
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

// Function that retrieves station coordinates from station ID
async function retrieveStationCoordinate(stationId: number): Promise<Coordinate> {
    const command = `
        SELECT latitude, longitude 
        FROM stations
        WHERE stationId = ?; 
    `;
    const database = await openDatabase();
    try {
        const [response] = await database.executeSql(command, [stationId]);
        const result = response.rows;
        if (result.length > 0) {
            const coordinate: Coordinate = {
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

// Function that retrieves Naptan ID from station ID
async function retrieveNaptanId(stationId: number): Promise<string> {
    const command = `
        SELECT naptanId
        FROM stations
        WHERE stationId = ?;
    `;
    const database = await openDatabase();
    try {
        const [response] = await database.executeSql(command, [stationId]);
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

// Function that retrieves potential station names based on search term
async function retrieveStationSuggestions(searchTerm: string): Promise<Array<Station>> {
    const command = `
        SELECT stationId, stationName
        FROM stations
        WHERE stationName LIKE ?
        ORDER BY stationName ASC
    `;
    const database = await openDatabase();
    try {
        const [response] = await database.executeSql(command, [`${searchTerm}%`]);
        const result = response.rows;
        const stations: Array<Station> = [];
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

// Function that retrieves line ID from line name
async function retrieveLineId(lineName: string): Promise<number> {
    const command = `
        SELECT lineId
        FROM lines
        WHERE lineName = ?;
    `;
    const database = await openDatabase();
    try {
        const [response] = await database.executeSql(command, [lineName]);
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

// Function that retrieves line name from line ID
async function retrieveLineName(lineId: number): Promise<string> {
    const command = `
        SELECT lineName
        FROM lines
        WHERE lineId = ?;
    `;
    const database = await openDatabase();
    try {
        const [response] = await database.executeSql(command, [lineId]);
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

// Function that retrieves all neighbouring stations from a station ID, along with line and travel time details
async function retrieveNeighbourStations(stationId: number): Promise<Array<AdjacentStation>> {
    const command = `
        SELECT toStationId, lineId, travelTime
        FROM connections
        WHERE connections.fromStationId = ?
    `;
    const database = await openDatabase();
    try {
        const [response] = await database.executeSql(command, [stationId]);
        const result = response.rows;
        const neighbourStations: Array<AdjacentStation> = [];
        for (let i = 0; i < result.length; i++) {
            const row = result.item(i);
            const neighbourStation: AdjacentStation = {
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

// Function that retrieves transfer time between lines at a station
async function retrieveTransferTime(stationId: number, fromLineId: number, toLineId: number): Promise<number> {
    // Average transfer time between lines is around 4 minutes, so uses this as default if no specific transfer time stored in database (shouldn't be the case though)
    const DEFAULT_TRANSFER_PENALTY_IN_MINUTES = 4;

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

    const database = await openDatabase();
    try {
        const [result1] = await database.executeSql(directQuery, [stationId, fromLineId, toLineId]);
        if (result1.rows.length > 0) {
            const row = result1.rows.item(0);
            return Number(row.transferTime);
        }
        const [result2] = await database.executeSql(reverseQuery, [stationId, toLineId, fromLineId]);
        if (result2.rows.length > 0) {
            const row = result2.rows.item(0);
            return Number(row.transferTime);
        }
        throw new Error(`No transfer time for ${stationId} between ${fromLineId} and ${toLineId}. Using default penalty.`);
    } catch (error) {
        console.error('Error retrieving transfer time:', error);
        return DEFAULT_TRANSFER_PENALTY_IN_MINUTES;
    }
}

// Debug function that retrieves all neighbouring stations from a station name and logs them to console
async function retrieveNeighbourStationsToView(stationName: string): Promise<void> {
    const command = `
        SELECT stations.stationName, lines.lineName, connections.travelTime
        FROM connections
        FULL JOIN stations
        ON stations.stationId = connections.toStationId
        FULL JOIN lines
        ON connections.lineId = lines.lineId
        WHERE fromStationId = (
            SELECT stationId 
            FROM stations
            WHERE stationName = ?
        );
    `;
    const database = await openDatabase();
    try {
        const [response] = await database.executeSql(command, [stationName]);
        const result = response.rows;
        for (let i = 0; i < result.length; i++) {
            const row = result.item(i);
            console.log(`Station: ${row.stationName}, Line: ${row.lineName}, Travel Time: ${row.travelTime} minutes`);
        }
    } catch (error) {
        console.error('Error retrieving neighbour stations:', error);
        throw error;
    }
}
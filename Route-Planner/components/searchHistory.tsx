import SQLite from 'react-native-sqlite-storage';
import { tubeDatabase } from './tubeDatabase';
import { RouteQuery } from './types';

// Enables promise-based API for database operations
SQLite.enablePromise(true);
const DATABASE_FILE_NAME = 'searchHistory.db'

// Maximum number of search history entries to retain
const MAX_HISTORY_ENTRIES = 15;

// Restricts database to a single instance in memory
let databaseInstance: SQLite.SQLiteDatabase | null = null;

// Function that opens database connection
async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (databaseInstance) {
        return databaseInstance;
    }
    try {
        const database = await SQLite.openDatabase({ name: DATABASE_FILE_NAME, createFromLocation: 1 });
        databaseInstance = database;
        return database;
    } catch (error) {
        console.error('Failed to open database:', error);
        throw error;
    }
}

// Function that logs search queries to database
export async function logSearch(fromStationId: number, toStationId: number): Promise<void> {
    const database = await openDatabase();

    // Checks if search query already exists in history
    const repeatedSearch = await isSearchAlreadyInHistory(fromStationId, toStationId);
    if (repeatedSearch) {
        // If search already exists, then updates timestamp to move it to top of history list
        await changeSearchTimestamp(fromStationId, toStationId);
    } else {
        // If search is new, then adds it to history list
        await insertSearchInHistory(fromStationId, toStationId);
    }
    return;
}

// Function that adds new search query to history
async function insertSearchInHistory(fromStationId: number, toStationId: number): Promise<void> {
    const database = await openDatabase();
    const timestamp = new Date().toISOString();
    const insertQuery = `
        INSERT INTO searchHistory (fromStationId, toStationId, timestamp)
        VALUES (?, ?, ?);
    `;
    try {
        await database.executeSql(insertQuery, [fromStationId, toStationId, timestamp]);
    } catch (error) {
        console.error('Failed to log search history:', error);
        throw error;
    }
}

// Function that retrieves search history from database, ordered by most recent searches
export async function fetchSearchHistory(): Promise<Array<RouteQuery>> {
    const database = await openDatabase();
    const query = `
        SELECT fromStationId, toStationId
        FROM searchHistory
        ORDER BY timestamp DESC;
    `;
    try {
        const [response] = await database.executeSql(query);
        const result = response.rows;
        const searchHistory: Array<RouteQuery> = [];
        for (let i = 0; i < Math.min(result.length, MAX_HISTORY_ENTRIES); i++) {
            const fromStationId = result.item(i).fromStationId;
            const toStationId = result.item(i).toStationId;
            const fromStationName = await tubeDatabase.retrieveStationName(fromStationId);
            const toStationName = await tubeDatabase.retrieveStationName(toStationId);
            const searchEvent: RouteQuery = {
                fromStationName,
                toStationName,
                fromStationId: fromStationId,
                toStationId: toStationId,
            }
            searchHistory.push(searchEvent);
        }
        return searchHistory;
    } catch (error) {
        console.error('Failed to retrieve search history:', error);
        throw error;
    }
}

// Function that updates timestamp of existing search query to current time
async function changeSearchTimestamp(fromStationId: number, toStationId: number): Promise<void> {
    const database = await openDatabase();
    const timestamp = new Date().toISOString();
    const updateQuery = `
        UPDATE searchHistory
        SET timestamp = ?
        WHERE fromStationId = ? AND toStationId = ?;
    `;
    try {
        await database.executeSql(updateQuery, [timestamp, fromStationId, toStationId]);
    } catch (error) {
        console.error('Failed to update search timestamp:', error);
        throw error;
    }
}

// Function that retrieves number of stored search queries in database
async function countSearchHistoryEntries(): Promise<number> {
    const countQuery = `
        SELECT COUNT(*) as count
        FROM searchHistory;
    `;
    const database = await openDatabase();
    try {
        const [response] = await database.executeSql(countQuery);
        const result = response.rows;
        const count = result.item(0).count;
        return count;
    } catch (error) {
        console.error('Failed to get search history count:', error);
        throw error;
    }
}

// Function that checks if search query already exists in history
async function isSearchAlreadyInHistory(fromStationId: number, toStationId: number): Promise<boolean> {
    const database = await openDatabase();
    const query = `
        SELECT COUNT(*) as count
        FROM searchHistory
        WHERE fromStationId = ? AND toStationId = ?;
    `;
    try {
        const [response] = await database.executeSql(query, [fromStationId, toStationId]);
        const result = response.rows;
        const count = result.item(0).count;
        return count > 0;
    } catch (error) {
        console.error('Failed to check search history:', error);
        throw error;
    }
}

// Function that deletes oldest entries if stored limit exceeded
export async function cleanUpSearchHistory(): Promise<void> {
    // Retrieves number of stored searches 
    const count = await countSearchHistoryEntries();

    // Checks if count exceeds set limit
    if (count <= MAX_HISTORY_ENTRIES) {
        return;
    }

    // If count exceeds limit, deletes oldest entries to free up storage space
    const entriesToDelete = count - MAX_HISTORY_ENTRIES;
    await deleteOldestEntries(entriesToDelete);
    return;
}

// Function that deletes oldest search queries from database based on timestamp
async function deleteOldestEntries(entriesToDelete: number): Promise<void> {
    const database = await openDatabase();
    const deleteQuery = `
        DELETE FROM searchHistory
        WHERE timestamp IN (
            SELECT timestamp
            FROM searchHistory
            ORDER BY timestamp ASC
            LIMIT ?
        );
    `;
    try {
        await database.executeSql(deleteQuery, [entriesToDelete]);
    } catch (error) {
        console.error('Failed to clean up search history:', error);
        throw error;
    }
}

// Function that clears all search history entries from the database
export async function clearSearchHistory(): Promise<void> {
    const database = await openDatabase();
    const deleteQuery = `
        DELETE FROM searchHistory;
    `;
    try {
        await database.executeSql(deleteQuery);
    } catch (error) {
        console.error('Failed to clear search history:', error);
        throw error;
    }
}

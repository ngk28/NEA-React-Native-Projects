import SQLite from 'react-native-sqlite-storage';
import { tubeDatabase } from './tubeDatabase';
import { searchHistoryEntry } from './types';

SQLite.enablePromise(true);
const MAX_HISTORY_ENTRIES = 15;

let databaseInstance: SQLite.SQLiteDatabase | null = null;

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (databaseInstance) {
        return databaseInstance;
    }
    try {
        const db = await SQLite.openDatabase({ name: 'searchHistoryV2.db', createFromLocation: 1 });
        databaseInstance = db;
        return db;
    } catch (error) {
        console.error('Failed to open database:', error);
        throw error;
    }
}

export async function deleteSearchHistory(): Promise<void> {
    const db = await openDatabase();
    const deleteQuery = `
        DELETE FROM searchHistory;
    `;
    try {
        await db.executeSql(deleteQuery);
    } catch (error) {
        console.error('Failed to clear search history:', error);
        throw error;
    }
}

export async function retrieveSearchHistory(): Promise<Array<searchHistoryEntry>> {
    const db = await openDatabase();
    const query = `
        SELECT fromStationId, toStationId
        FROM searchHistory
        ORDER BY timestamp DESC;
    `;
    try {
        const [response] = await db.executeSql(query);
        const result = response.rows;
        const history: Array<searchHistoryEntry> = [];
        for (let i = 0; i < Math.min(result.length, MAX_HISTORY_ENTRIES); i++) {
            const fromStationId = result.item(i).fromStationId;
            const toStationId = result.item(i).toStationId;
            const fromStationName = await tubeDatabase.retrieveStationName(fromStationId);
            const toStationName = await tubeDatabase.retrieveStationName(toStationId);
            const searchEvent = {
                fromStationName,
                toStationName,
                fromStationId: fromStationId,
                toStationId: toStationId,
            }
            history.push(searchEvent);
        }
        return history;
    } catch (error) {
        console.error('Failed to retrieve search history:', error);
        throw error;
    }
}

export async function logSearchHistory(fromStationId: number, toStationId: number) {
    const db = await openDatabase();
    const repeatedSearch = await isSearchAlreadyInHistory(fromStationId, toStationId);
    if (repeatedSearch) {
        await changeSearchTimestamp(fromStationId, toStationId);
        return;
    } else {
        await enterSearchInHistory(fromStationId, toStationId);
    }
}

async function isSearchAlreadyInHistory(fromStationId: number, toStationId: number): Promise<boolean> {
    const db = await openDatabase();
    const query = `
        SELECT COUNT(*) as count
        FROM searchHistory
        WHERE fromStationId = ? AND toStationId = ?;
    `;
    try {
        const [response] = await db.executeSql(query, [fromStationId, toStationId]);
        const result = response.rows;
        const count = result.item(0).count;
        return count > 0;
    } catch (error) {
        console.error('Failed to check search history:', error);
        throw error;
    }
}

async function enterSearchInHistory(fromStationId: number, toStationId: number): Promise<void> {
    const db = await openDatabase();
    const timestamp = new Date().toISOString();
    const insertQuery = `
        INSERT INTO searchHistory (fromStationId, toStationId, timestamp)
        VALUES (?, ?, ?);
    `;
    try {
        await db.executeSql(insertQuery, [fromStationId, toStationId, timestamp]);
    } catch (error) {
        console.error('Failed to log search history:', error);
        throw error;
    }
}

async function changeSearchTimestamp(fromStationId: number, toStationId: number): Promise<void> {
    const db = await openDatabase();
    const timestamp = new Date().toISOString();
    const updateQuery = `
        UPDATE searchHistory
        SET timestamp = ?
        WHERE fromStationId = ? AND toStationId = ?;
    `;
    try {
        await db.executeSql(updateQuery, [timestamp, fromStationId, toStationId]);
    } catch (error) {
        console.error('Failed to update search timestamp:', error);
        throw error;
    }
}

export async function cleanUpSearchHistory(): Promise<void> {
    const count = await getSearchHistoryCount();
    if (count <= MAX_HISTORY_ENTRIES) {
        return;
    }
    const entriesToDelete = count - MAX_HISTORY_ENTRIES;
    await deleteOldestSearch(entriesToDelete);
    return;
}

async function getSearchHistoryCount(): Promise<number> {
    const countQuery = `
    SELECT COUNT(*) as count
    FROM searchHistory;
    `;
    const db = await openDatabase();
    try {
        const [response] = await db.executeSql(countQuery);
        const result = response.rows;
        const count = result.item(0).count;
        return count;
    } catch (error) {
        console.error('Failed to get search history count:', error);
        throw error;
    }
}

async function deleteOldestSearch(entriesToDelete: number): Promise<void> {
    const db = await openDatabase();
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
        await db.executeSql(deleteQuery, [entriesToDelete]);
    } catch (error) {
        console.error('Failed to clean up search history:', error);
        throw error;
    }
}
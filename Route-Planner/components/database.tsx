import { createContext, useContext, useEffect, useState } from 'react';
import SQLite from 'react-native-sqlite-storage';

let databaseInstance: SQLite.SQLiteDatabase | undefined;

export interface Database {
    open(): Promise<SQLite.SQLiteDatabase>;
    retrieveStations(stationId: number): Promise<Array<{ toStationId: number; lineId: number; Time: number }>>;
    countStations(): number;
};

export const Database: Database = {
    open,
    retrieveStations: retrieveNeighbourStations,
    countStations: countNumberOfStations,
}

async function open(): Promise<SQLite.SQLiteDatabase> {
    if (databaseInstance) {
        return databaseInstance;
    }
    SQLite.enablePromise(true);
    const db = await SQLite.openDatabase(
        { name: 'LondonUndergroundTestV3.db', createFromLocation: 1, readOnly: true },
        opened => console.log('Database opened successfully'),
        error => console.error('Error opening database: ', error)
    );

    databaseInstance = db;
    return db;
}
function countNumberOfStations(): number {
    const command = `SELECT COUNT(*) as count FROM stations`;
    var count = -1;
    databaseInstance?.transaction(tx => {
        tx.executeSql(command, [], (tx, results) => {
            var count = results.rows.item(0).count;
            console.log('Number of stations:', count);
        }, (tx, error) => {
            console.error('Error counting stations: ', error);
        });
    });
    console.log('Number of stations:', count);
    return count;
}
async function retrieveNeighbourStations(stationId: number): Promise<Array<{ toStationId: number; lineId: number; Time: number }>> {
    const command = `
        SELECT connections.toStationId, lines.lineId, connections.Time
        FROM connections
        FULL JOIN stations ON stations.stationId = connections.toStationId
        FULL JOIN lines ON connections.lineId = lines.lineId
        WHERE fromStationId = ?
    `;
    const stations: Array<{ toStationId: number; lineId: number; Time: number }> = [];
    databaseInstance?.transaction(tx => {
        tx.executeSql(command, [stationId], (tx, results) => {
            for (let i = 0; i < results.rows.length; i++) {
                const row = results.rows.item(i);
                const { toStationId, lineId, Time } = row;
                stations.push({ toStationId, lineId, Time });
            }
            console.log('Stations retrieved:', stations);
        });
    });

    return stations;
} 
import { createContext, useContext, useEffect, useState } from 'react';
import SQLite from 'react-native-sqlite-storage';

let databaseInstance: SQLite.SQLiteDatabase | undefined;

export interface Database {
    open(): Promise<SQLite.SQLiteDatabase>;
    retrieveStations(): Promise<void>;
};

export const Database: Database = {
    open,
    retrieveStations,
}

async function open(): Promise<SQLite.SQLiteDatabase> {
    SQLite.enablePromise(true);
    const db = await SQLite.openDatabase(
        { name: 'LondonUndergroundTestV3.db', createFromLocation: 1, readOnly: true },
        opened => console.log('Database opened successfully'),
        error => console.error('Error opening database: ', error)
    );

    databaseInstance = db;
    return db;
}

async function retrieveStations(stationId?: number): Promise<void> {
    const command = `
        SELECT connections.toStationId, lines.lineId, connections.Time
        FROM connections
        FULL JOIN stations ON stations.stationId = connections.toStationId
        FULL JOIN lines ON connections.lineId = lines.lineId
        WHERE fromStationId = ?
    `;
    databaseInstance?.transaction(tx => {
        tx.executeSql(command, [stationId], (tx, results) => {
            const stations = [];
            for (let i = 0; i < results.rows.length; i++) {
                const row = results.rows.item(i);
                const { toStationId, lineId, Time } = row;
                stations.push({ toStationId, lineId, Time });
            }
            console.log('Stations retrieved:', stations);
        });
    });
}
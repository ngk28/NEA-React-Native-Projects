import React from 'react';
import SQL from 'react-native-sqlite-storage';
import { Database } from '@/components/database';
// import real-time delay consideration

export interface PathFinderResult {
    useDijkstra(fromStationId: number, toStationId: number): Promise<{ shortestPath: number[] }>;
}
export const PathFinderResult: PathFinderResult = {
    useDijkstra: useDijkstra,
}
const [shortestPath, setShortestPath] = React.useState<number[]>([]);
const [totalTime, setTotalTime] = React.useState<number>(0);
async function useDijkstra(fromStationId: number, toStationId: number): Promise<{ shortestPath: number[] }> {

    let nodesToVisit = [];
    let visitedNodes = new Set<number>();
    let numberOfStations = await Database.countStations();


    function generateGrid() {
        const nodes = [];


    }
    console.log(shortestPath);
    return { shortestPath };
}

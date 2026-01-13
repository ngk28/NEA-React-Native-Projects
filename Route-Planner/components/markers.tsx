import { Database } from "./database";
import { generateStationLineList } from "./pathFinder";

export type stationCoords = {
    stationId: number;
    coordinates: [number, number];
};

export async function generateStationCoords(): Promise<stationCoords[]> {
    const stationCoordsList: stationCoords[] = [];
    const stations = await generateStationLineList();
    try {
        for (let i = 0; i < stations.length; i++) {
            const coordinate = await Database.retrieveStationCoordinate(stations[i].stationId);
            const stationCoord = {
                stationId: stations[i].stationId,
                coordinates: coordinate,
            }
            stationCoordsList.push(stationCoord);
        }
    } catch (err) {
        console.error('Error loading station coordinates:', err);
    }
    return stationCoordsList;
}
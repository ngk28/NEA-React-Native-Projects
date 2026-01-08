import { Database } from '@/components/database';
import { useEffect, useState } from 'react';

export type PathFinderResult = {
    shortestPath: number[];
    totalTime: number;
};

// Converts latitude amd longitude to distance in kilometres using the Haversine formula
function HaversineDistance(latitude1: number, longitude1: number, latitude2: number, longitude2: number): number {
    const EARTH_RADIUS = 6371e3;
    const theta1 = latitude1 * Math.PI / 180;
    const theta2 = latitude2 * Math.PI / 180;
    const deltaTheta = (latitude2 - latitude1) * Math.PI / 180;
    const deltaLambda = (longitude2 - longitude1) * Math.PI / 180;

    const a = Math.sin(deltaTheta / 2) * Math.sin(deltaTheta / 2) +
        Math.cos(theta1) * Math.cos(theta2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMetres = EARTH_RADIUS * c;
    const distanceKilometres = distanceMetres / 1000;
    return distanceKilometres;
}
function reconstructPath(previous: Map<number, number | null>, toStationId: number): number[] {
    const path: number[] = [];
    let currentStationId: number | null = toStationId;
    while (currentStationId !== null) {
        path.unshift(currentStationId);
        currentStationId = previous.get(currentStationId) || null;
    }
    return path;
}

export async function computeShortestPath(fromStationId: number, toStationId: number): Promise<PathFinderResult> {
    const visited = new Set<number>();
    const previous = new Map<number, number | null>();
    const optimalTime = new Map<number, number>();
    const [toStationLatitude, toStationLongitude] = await Database.retrieveStationCoordinate(toStationId);
    const [fromStationLatitude, fromStationLongitude] = await Database.retrieveStationCoordinate(fromStationId);
    var currentlineId: number | null = null;

    const queue: Array<{ stationId: number; estimatedTime: number, lineId: number | null }> = [];

    // Heuristics: Use real-life distance to estimate distance from start to destination
    var estimatedCost = HaversineDistance(fromStationLatitude, fromStationLongitude, toStationLatitude, toStationLongitude);
    // Real distance from start to start is 0
    optimalTime.set(fromStationId, 0);
    // LineId = null means journey can start from any line without time punishment 
    queue.push({ stationId: fromStationId, estimatedTime: estimatedCost, lineId: null });


    while (queue.length > 0) {
        // Optional Extension todo?: Optimize queue to a priority queue to - always get node with the smallest distance without sorting
        queue.sort((a, b) => a.estimatedTime - b.estimatedTime);
        // Removes first element - ! tells program queue is certainly not empty 
        const current = queue.shift()!;

        // Optimal path found and exit
        if (current.stationId === toStationId) {
            // Debug info
            const stationsEvaluated = visited.size;
            console.log(`Stations visited: ${stationsEvaluated}`);
            const stationsInQueue = queue.length;
            console.log(`Stations remaining in queue: ${stationsInQueue}`);
            const shortestPath = reconstructPath(previous, toStationId);

            const totalTime = optimalTime.get(toStationId)!;
            return { shortestPath, totalTime };
        }

        visited.add(current.stationId);
        const neighbours = await Database.retrieveNeighbourStations(current.stationId);

        for (const neighbour of neighbours) {
            // If already visited station, skip evaluating it 
            if (visited.has(neighbour.toStationId)) {
                continue;
            }

            // Calculate future distance to neighbour - same process as before
            const [neighbourLatitude, neighbourLongitude] = await Database.retrieveStationCoordinate(neighbour.toStationId);
            const estimateFutureTime = HaversineDistance(neighbourLatitude, neighbourLongitude, toStationLatitude, toStationLongitude);

            // Current distance travelled + travel time to neighbour so far (no heuristics)
            var tentativeTime = optimalTime.get(current.stationId)! + neighbour.travelTime;

            // if differentLine, add per-station/per-line transfer time, no transfer time for walking connections
            if (current.lineId !== null && neighbour.lineId !== current.lineId) {
                if (!(current.lineId === 12 || neighbour.lineId === 12)) {
                    try {
                        const transferTime = await Database.retrieveTransferTime(current.stationId, current.lineId, neighbour.lineId);
                        tentativeTime += transferTime;
                    } catch (error) {
                        console.error('Error retrieving transfer time:', error);
                    }
                }
            }

            var newEstimatedTime = tentativeTime + estimateFutureTime;
            // TODO : Check queue logic?? only checks against stationId, not lineId 
            const stationQueueIndex = queue.findIndex(item => item.stationId === neighbour.toStationId);

            // If neighbour station and line combination not already in queue, or found a better path to neighbour
            if (stationQueueIndex === -1) {
                if (queue.at(stationQueueIndex)?.lineId !== neighbour.lineId) {
                    queue.push({ stationId: neighbour.toStationId, estimatedTime: newEstimatedTime, lineId: neighbour.lineId });
                }

                // Same line path is worse
                else if (tentativeTime >= (optimalTime.get(neighbour.toStationId) || Infinity)) {
                    continue;
                }

                // Path is better
                optimalTime.set(neighbour.toStationId, tentativeTime);
                previous.set(neighbour.toStationId, current.stationId);
            }

        }
    }
    return { shortestPath: [], totalTime: 1000 };
}


export function useDijkstra(fromStationId: number | null, toStationId: number | null) {
    const [shortestPath, setShortestPath] = useState<number[]>([]);
    const [totalTime, setTotalTime] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (fromStationId == null || toStationId == null) return;
        setLoading(true);
        setError(null);

        computeShortestPath(fromStationId, toStationId)
            .then(result => {
                setShortestPath(result.shortestPath);
                setTotalTime(result.totalTime);
                console.log('From station ID:', fromStationId, 'To station ID:', toStationId);
                console.log('Shortest path:', result.shortestPath, 'Total time:', result.totalTime);
            })
            .catch(error => {
                setError(error instanceof Error ? error : new Error(String(error)));
            })

        return () => {
        };
    }, [fromStationId, toStationId]);

    return { shortestPath, totalTime, loading, error } as const;

}

import { useEffect, useState } from 'react';
import { Database } from '@/components/database';

export type PathFinderResult = {
    shortestPath: number[];
    totalTime: number;
};

function HaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const theta1 = lat1 * Math.PI / 180;
    const theta2 = lat2 * Math.PI / 180;
    const deltaTheta = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaTheta / 2) * Math.sin(deltaTheta / 2) +
        Math.cos(theta1) * Math.cos(theta2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // in metres
    return distance / 1000; // return in kilometres
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
    // const neighbours = await Database.retrieveStations(fromStationId);
    // TODO: implement Dijkstra using Database.retrieveStations
    const visited = new Set<number>();
    const previous = new Map<number, number | null>();
    const distances = new Map<number, number>();
    const [toStationLat, toStationLon] = await Database.retrieveStationCoordinate(toStationId);
    const [fromStationLat, fromStationLon] = await Database.retrieveStationCoordinate(fromStationId);

    const queue: Array<{ stationId: number; distance: number }> = [];

    var estimatedCost = HaversineDistance(fromStationLat, fromStationLon, toStationLat, toStationLon);
    distances.set(fromStationId, 0);
    queue.push({ stationId: fromStationId, distance: estimatedCost });

    while (queue.length > 0) {
        queue.sort((a, b) => a.distance - b.distance); // TODO: Optimize the queue to always get the node with the smallest distance without sorting
        const current = queue.shift()!;
        if (current.stationId === toStationId) {
            const shortestPath = reconstructPath(previous, toStationId);
            const totalTime = distances.get(toStationId) ?? 0;
            const stationsEvaluated = visited.size;
            console.log(`Stations visited: ${stationsEvaluated}`);
            const stationsInQueue = queue.length;
            console.log(`Stations remaining in queue: ${stationsInQueue}`);
            return { shortestPath, totalTime };
        }
        visited.add(current.stationId);
        const neighbours = await Database.retrieveNeighbourStations(current.stationId);
        for (const neighbour of neighbours) {
            if (visited.has(neighbour.toStationId)) {
                continue;
            }
            const [neighbourLat, neighbourLon] = await Database.retrieveStationCoordinate(neighbour.toStationId);
            const tentativeDistance = distances.get(current.stationId)! + neighbour.travelTime;
            const estimatedCost = HaversineDistance(neighbourLat, neighbourLon, toStationLat, toStationLon);
            // if differentLine 
            if (queue.findIndex(item => item.stationId === neighbour.toStationId) === -1) {
                queue.push({ stationId: neighbour.toStationId, distance: tentativeDistance + estimatedCost });
            }
            else if (tentativeDistance >= (distances.get(neighbour.toStationId) || Infinity)) {
                // Path is worse
                continue;
            }
            // Path is better
            distances.set(neighbour.toStationId, tentativeDistance);
            previous.set(neighbour.toStationId, current.stationId);
        }
    }
    return { shortestPath: [], totalTime: 1000 };
}

// Hook wrapper for components that need reactive results.
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
            .catch(err => {
                setError(err instanceof Error ? err : new Error(String(err)));
            })

        return () => {
        };
    }, [fromStationId, toStationId]);

    return { shortestPath, totalTime, loading, error } as const;
}

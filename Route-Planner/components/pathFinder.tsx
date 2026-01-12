import { Database } from '@/components/database';

export type PathFinderResult = {
    shortestPathStations: number[];
    shortestPathLines: number[];
    totalTime: number;
    stationLinePairsEvaluated: number;
    stationLinePairsInQueue: number;
};

// Converts latitude and longitude to distance in kilometres using the Haversine formula
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

function reconstructPath(previous: Map<string, string | null>, stationLineKey: string): { stationPath: number[], linePath: number[] } {
    const stationPath: number[] = [];
    const linePath: number[] = [];
    let currentStationLineKey: string | null = stationLineKey;
    while (currentStationLineKey !== null) {
        const stationId = parseInt(currentStationLineKey.split('-')[0]);
        stationPath.unshift(stationId);
        const lineIdStr = currentStationLineKey.split('-')[1];
        if (lineIdStr !== 'null') {
            const lineId = parseInt(lineIdStr);
            linePath.unshift(lineId);
        }
        currentStationLineKey = previous.get(currentStationLineKey) || null;
    }
    return { stationPath, linePath };
}

async function computeShortestPath(fromStationId: number, toStationId: number): Promise<PathFinderResult> {
    const visited = new Set<string>(); // Track stationId-lineId pairs
    const previous = new Map<string, string | null>(); // Track stationId-lineId pairs
    const optimalTime = new Map<string, number>(); // Key: stationId-lineId, Value: optimal time to reach station via specific line
    const [toStationLatitude, toStationLongitude] = await Database.retrieveStationCoordinate(toStationId);
    const [fromStationLatitude, fromStationLongitude] = await Database.retrieveStationCoordinate(fromStationId);

    const queue: Array<{ stationId: number; estimatedTime: number, lineId: number | null }> = [];

    // Heuristics: Use real-life distance to estimate approximate time from start to destination
    var estimatedCost = HaversineDistance(fromStationLatitude, fromStationLongitude, toStationLatitude, toStationLongitude);
    // Initialize start state being from any line
    const startStateKey = `${fromStationId}-null`;
    previous.set(startStateKey, null);
    // Time from start to start is 0
    optimalTime.set(startStateKey, 0);
    // LineId = null means journey can start from any line without time punishment 
    queue.push({ stationId: fromStationId, estimatedTime: estimatedCost, lineId: null });

    while (queue.length > 0) {
        // Optional Extension todo?: Optimize queue to a priority queue to - always get node with the smallest distance without sorting
        queue.sort((a, b) => a.estimatedTime - b.estimatedTime);
        // Removes first element - ! tells program queue is certainly not empty 
        const current = queue.shift()!;

        const currentStationLineKey = `${current.stationId}-${current.lineId}`;

        // Skip if already processed this exact station-line combination
        if (visited.has(currentStationLineKey)) {
            continue;
        }
        visited.add(currentStationLineKey);

        // Optimal path found and exit
        if (current.stationId === toStationId) {
            const stationLinePairsEvaluated = visited.size;
            const stationLinePairsInQueue = queue.length;
            const shortestPath = reconstructPath(previous, currentStationLineKey);
            const shortestPathStations = shortestPath.stationPath;
            const shortestPathLines = shortestPath.linePath;
            const totalTime = optimalTime.get(currentStationLineKey)!;
            return { shortestPathStations, shortestPathLines, totalTime, stationLinePairsEvaluated, stationLinePairsInQueue };
        }

        const neighbours = await Database.retrieveNeighbourStations(current.stationId);

        for (const neighbour of neighbours) {
            // Skip if already visited this specific station-line combination
            const neighbourStationLineKey = `${neighbour.toStationId}-${neighbour.lineId}`;
            if (visited.has(neighbourStationLineKey)) {
                continue;
            }

            // Calculate future time/distance to neighbour
            const [neighbourLatitude, neighbourLongitude] = await Database.retrieveStationCoordinate(neighbour.toStationId);
            const estimateFutureTime = HaversineDistance(neighbourLatitude, neighbourLongitude, toStationLatitude, toStationLongitude);

            // Current distance travelled + travel time to neighbour so far (no heuristics)
            var tentativeTime = optimalTime.get(currentStationLineKey)! + neighbour.travelTime;

            // If different line, add per-station/per-line transfer time, no transfer time for walking connections
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
            const queueStationLineIndex = queue.findIndex(item => item.stationId === neighbour.toStationId && item.lineId === neighbour.lineId);

            // If neighbour station-line not already in queue (not visited yet)
            if (queueStationLineIndex === -1) {
                queue.push({ stationId: neighbour.toStationId, estimatedTime: newEstimatedTime, lineId: neighbour.lineId });
                optimalTime.set(neighbourStationLineKey, tentativeTime);
                previous.set(neighbourStationLineKey, currentStationLineKey);
            }
            // If path exists in queue but new path is better, update it
            else if (tentativeTime < (optimalTime.get(neighbourStationLineKey) || Infinity)) {
                optimalTime.set(neighbourStationLineKey, tentativeTime);
                previous.set(neighbourStationLineKey, currentStationLineKey);
                queue[queueStationLineIndex].estimatedTime = newEstimatedTime;
            }
        }
    }
    return { shortestPathStations: [], shortestPathLines: [], totalTime: Infinity, stationLinePairsEvaluated: 0, stationLinePairsInQueue: 0 };
}

// Store the most recently calculated path for quick access
let cachedPath: PathFinderResult | null = null;
let cachedPathKey: string | null = null;

export async function retrieveOptimalRoute(fromStationId: number, toStationId: number): Promise<PathFinderResult> {
    const pathKey = `${fromStationId}-${toStationId}`;
    if (cachedPath !== null && cachedPathKey === pathKey) return cachedPath;
    const result = await computeShortestPath(fromStationId, toStationId);
    cachedPath = result;
    cachedPathKey = pathKey;

    // Diagnostic logs
    console.log('From station ID:', fromStationId, 'To station ID:', toStationId);
    console.log('Station-line pairs visited:', result.stationLinePairsEvaluated);
    console.log('Station-line pairs in queue:', result.stationLinePairsInQueue);
    console.log('Shortest path (stations):', result.shortestPathStations, 'Total time:', result.totalTime);
    console.log('Shortest path (names):', await formatPathAsNames(result.shortestPathStations));
    console.log('Shortest path (lines):', result.shortestPathLines);
    console.log('Shortest path (line names):', await formatLinesAsNames(result.shortestPathLines));

    return result;
}

export function getCachedPath(): PathFinderResult | null {
    if (cachedPath === null) {
        console.warn('No cached path available.');
        return null;
    }
    return cachedPath;
}


async function formatPathAsNames(path: Array<number>): Promise<Array<string>> {
    const stationNames: Array<string> = [];
    for (const stationId of path) {
        const stationName = await Database.retrieveStationName(stationId);
        stationNames.push(stationName);
    }
    return stationNames;
}
async function formatLinesAsNames(path: Array<number>): Promise<Array<string>> {
    const lineNames: Array<string> = [];
    for (const lineId of path) {
        const lineName = await Database.retrieveLineName(lineId);
        lineNames.push(lineName);
    }
    return lineNames;
}

// export async function retrievePathByStationId(fromStationId: number, toStationId: number): Promise<Array<number>> {
//     const result = await retrieveOptimalRoute(fromStationId, toStationId);
//     return result.shortestPathStations;
// }
// export async function retrievePathByName(fromStationId: number, toStationId: number): Promise<Array<string>> {
//     const result = await retrieveOptimalRoute(fromStationId, toStationId);
//     return formatPathAsNames(result.shortestPathStations);
// }
// export async function retrievePathLine(fromStationId: number, toStationId: number): Promise<Array<number>> {
//     const result = await retrieveOptimalRoute(fromStationId, toStationId);
//     return result.shortestPathLines;
// }
// export async function retrieveShortestTime(fromStationId: number, toStationId: number): Promise<number> {
//     const result = await retrieveOptimalRoute(fromStationId, toStationId);
//     return result.totalTime;
// }
// export async function retrieveDiagnosticInfo(fromStationId: number, toStationId: number): Promise<{ stationLinePairsEvaluated: number; stationLinePairsInQueue: number }> {
//     const result = await retrieveOptimalRoute(fromStationId, toStationId);
//     return {
//         stationLinePairsEvaluated: result.stationLinePairsEvaluated,
//         stationLinePairsInQueue: result.stationLinePairsInQueue
//     };
// }


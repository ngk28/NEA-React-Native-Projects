import { fetchDisruptionTimeForLine } from '@/components/disruptionAPI';
import { tubeDatabase } from '@/components/tubeDatabase';
import { coordinate, neighbourStation, optimalRouteResult, routeKey, station } from '@/components/types';
import { PriorityQueue } from './priorityQueue';

// Store the most recently calculated path for quick access
let cachedOptimalRoute: optimalRouteResult | null = null;
let cachedRouteKey: routeKey | null = null;
let cachedPathStationDetails: Array<station> | null = null;

// Converts latitude and longitude to distance in kilometres using the Haversine formula
function HaversineDistance(coordinate1: coordinate, coordinate2: coordinate): number {
    const EARTH_RADIUS = 6371e3;
    const theta1 = coordinate1.latitude * Math.PI / 180;
    const theta2 = coordinate2.latitude * Math.PI / 180;
    const deltaTheta = (coordinate2.latitude - coordinate1.latitude) * Math.PI / 180;
    const deltaLambda = (coordinate2.longitude - coordinate1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaTheta / 2) * Math.sin(deltaTheta / 2) +
        Math.cos(theta1) * Math.cos(theta2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMetres = EARTH_RADIUS * c;
    const distanceKilometres = distanceMetres / 1000;
    return distanceKilometres;
}

// Get cached path without recomputation, catches null error (for all functions calling it) if no cached path
function getCachedRoute(): optimalRouteResult {
    try {
        if (cachedOptimalRoute === null) {
            console.warn('No cached path available.');
            throw new Error('No cached path available.');
        }
    } catch (error) {
        console.error('Error retrieving cached path:', error);
        throw error;
    }
    return cachedOptimalRoute;
}

// Get cached path station details without recomputation
function getCachedPathStationDetails(): Array<station> {
    try {
        if (cachedPathStationDetails === null) {
            console.warn('No cached path station details available.');
            throw new Error('No cached path station details available.');
        }
    } catch (error) {
        console.error('Error retrieving cached path station details:', error);
        throw error;
    }
    return cachedPathStationDetails;
}

export async function generateStationLineList() {
    const route = getCachedRoute();

    // Tries to use cached station details if available and route key matches
    const routeKey: routeKey = {
        fromStationId: route.optimalStationSequence[0],
        toStationId: route.optimalStationSequence[route.optimalStationSequence.length - 1]
    };

    if (cachedPathStationDetails !== null && cachedRouteKey !== null && cachedRouteKey === routeKey) {
        return getCachedPathStationDetails();
    }

    const stationSequence = route.optimalStationSequence;
    const stationNames = await formatStationAsNames(stationSequence);
    const lineSequence = route.optimizedLineSequence;

    const stationOnPathDetails: Array<station> = await createStationDetail(stationNames, stationSequence);
    await addLineNamesToStation(stationOnPathDetails, lineSequence, stationSequence); // Pass by reference
    await addCoordinatesToStation(stationOnPathDetails); // Pass by reference

    cachedPathStationDetails = stationOnPathDetails;
    return stationOnPathDetails;
}

export async function generateTransferStationList(): Promise<Array<station>> {
    const stationDetails = await generateStationLineList();
    const transferStations = stationDetails.filter((station) => station.fromLineName !== station.toLineName);
    return transferStations;
}

async function createStationDetail(stationNames: Array<string>, stationSequence: Array<number>): Promise<Array<station>> {
    const stations: Array<station> = [];
    for (let i = 0; i < stationSequence.length; i++) {
        const stationDetail: station = {
            id: stationSequence[i],
            name: stationNames[i],
        };
        stations.push(stationDetail);
    }
    return stations;
}

async function addLineNamesToStation(stationDetails: Array<station>, lineSequence: Array<number>, stationSequence: Array<number>) {
    try {
        for (let i = 0; i < stationDetails.length; i++) {
            if (i !== 0) {
                const fromLineId = lineSequence[i - 1];
                const fromLineName = await tubeDatabase.retrieveLineName(fromLineId);
                stationDetails[i].fromLineName = fromLineName;
            }
            if (i !== stationSequence.length - 1) {
                const toLineId = lineSequence[i];
                const toLineName = await tubeDatabase.retrieveLineName(toLineId);
                stationDetails[i].toLineName = toLineName;
            }
        }
    } catch (error) {
        console.error('Error generating station list:', error);
    }
}

async function addCoordinatesToStation(stationDetails: Array<station>) {
    try {
        for (let i = 0; i < stationDetails.length; i++) {
            const coordinate: coordinate = await tubeDatabase.retrieveStationCoordinate(stationDetails[i].id);
            stationDetails[i].latitude = coordinate.latitude;
            stationDetails[i].longitude = coordinate.longitude;
        }
    } catch (error) {
        console.error('Error adding coordinates to station list:', error);
    }
}

async function formatStationAsNames(path: Array<number>): Promise<Array<string>> {
    const stationNames: Array<string> = [];
    for (const stationId of path) {
        const stationName = await tubeDatabase.retrieveStationName(stationId);
        stationNames.push(stationName);
    }
    return stationNames;
}

async function formatLinesAsNames(path: Array<number>): Promise<Array<string>> {
    const lineNames: Array<string> = [];
    for (const lineId of path) {
        const lineName = await tubeDatabase.retrieveLineName(lineId);
        lineNames.push(lineName);
    }
    return lineNames;
}

export async function retrieveOptimalRoute(fromStationId: number, toStationId: number): Promise<optimalRouteResult> {
    // Tries to use cached path if available and route key matches
    const routeKey: routeKey = {
        fromStationId: fromStationId,
        toStationId: toStationId
    };
    if (cachedOptimalRoute !== null && cachedRouteKey !== null && cachedRouteKey === routeKey) {
        return getCachedRoute();
    }

    const shortestPath = await computeShortestPath(fromStationId, toStationId);
    cachedOptimalRoute = shortestPath;
    const generatedStationDetails = await generateStationLineList();
    cachedPathStationDetails = generatedStationDetails;
    cachedRouteKey = routeKey;

    // Diagnostic logs
    // console.log('From station ID:', fromStationId, 'To station ID:', toStationId);
    // console.log('Station-line pairs visited:', result.stationLinePairsEvaluated);
    // console.log('Station-line pairs in queue:', result.stationLinePairsInQueue);
    // console.log('Shortest path (stations):', result.optimalStationSequence, 'Total time:', result.totalTime);
    // console.log('Shortest path (names):', await formatStationAsNames(shortestPath.optimalStationSequence));
    // console.log('Shortest path (lines):', result.optimizedLineSequence);
    // console.log('Shortest path (line names):', await formatLinesAsNames(shortestPath.optimizedLineSequence));

    return shortestPath;
}


// Check if line delay has already been applied on the current path
function doesPathContainsLine(previousNodeMap: Map<string, string | null>, stationLineKey: string, neighbourLine: number | null): boolean {
    if (neighbourLine === null) {
        return false;
    }
    let currentKey: string | null = stationLineKey;
    while (currentKey !== null) {
        const previousLine = currentKey.split('-')[1];
        if (previousLine !== 'null' && parseInt(previousLine) === neighbourLine) {
            return false;
        }
        currentKey = previousNodeMap.get(currentKey) || null;
    }
    return true;
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



// A* Search Algorithm Implementation
// Nodes kept as string "stationId-lineId" to differentiate between same station on different lines
// Must be string for map to work properly
async function computeShortestPath(fromStationId: number, toStationId: number): Promise<optimalRouteResult> {
    const visitedNodes = new Set<string>();
    const previousNodeMap = new Map<string, string | null>();
    const optimalTime = new Map<string, number>();
    let priorityQueue = new PriorityQueue<neighbourStation>();
    const toStationCoordinate: coordinate = await tubeDatabase.retrieveStationCoordinate(toStationId);
    const fromStationCoordinate: coordinate = await tubeDatabase.retrieveStationCoordinate(fromStationId);

    // Initialize start state being from any line
    const startStateKey = `${fromStationId}-null`;
    previousNodeMap.set(startStateKey, null);
    optimalTime.set(startStateKey, 0);
    var estimatedTravelTime = HaversineDistance(fromStationCoordinate, toStationCoordinate); // Heuristics: Use real-life distance to estimate approximate time from start to destination
    const startingStation: neighbourStation = {
        stationId: fromStationId,
        travelTime: estimatedTravelTime,
        lineId: null
    }
    priorityQueue.enqueue(startingStation, estimatedTravelTime);

    while (priorityQueue.size() > 0) {
        const currentNode = priorityQueue.dequeue()!;

        // Skip if already processed this exact station-line combination
        const currentStationLineKey = `${currentNode.stationId}-${currentNode.lineId}`;
        if (visitedNodes.has(currentStationLineKey)) {
            continue;
        }
        visitedNodes.add(currentStationLineKey);

        // Optimal path found and exit
        if (currentNode.stationId === toStationId) {
            const optimalRoute = createOptimalRouteOutput(currentStationLineKey);
            return optimalRoute;
        }

        const neighbours = await tubeDatabase.retrieveNeighbourStations(currentNode.stationId);
        for (const neighbour of neighbours) {

            // Skip if already visited this specific station-line combination
            const neighbourStationLineKey = `${neighbour.stationId}-${neighbour.lineId}`;
            if (visitedNodes.has(neighbourStationLineKey)) {
                continue;
            }

            const neighbourCoordinate: coordinate = await tubeDatabase.retrieveStationCoordinate(neighbour.stationId);
            const estimateFutureTime = HaversineDistance(neighbourCoordinate, toStationCoordinate);

            // If interchange, add transfer time (if not walking connection which is a transfer itself)
            const transferTime = await calculateTransferTime(currentNode.stationId, currentNode.lineId, neighbour.lineId);
            const disruptionDelay = await calculateDelayTime(currentNode.stationId, currentStationLineKey, neighbour.lineId);
            // Current distance travelled + travel time to neighbour + disruption delay (no heuristics) 
            var calculatedTravelTime = optimalTime.get(currentStationLineKey)! + neighbour.travelTime + disruptionDelay + transferTime;

            // New estimated time = tentative time + heuristic estimate to goal
            var newEstimatedTime = calculatedTravelTime + estimateFutureTime;
            const newNeighbourStation: neighbourStation = {
                stationId: neighbour.stationId,
                travelTime: newEstimatedTime,
                lineId: neighbour.lineId
            }
            priorityQueue.enqueue(newNeighbourStation, newEstimatedTime);
            if (!optimalTime.has(neighbourStationLineKey) || calculatedTravelTime < optimalTime.get(neighbourStationLineKey)!) {
                optimalTime.set(neighbourStationLineKey, calculatedTravelTime);
                previousNodeMap.set(neighbourStationLineKey, currentStationLineKey);
            }
        }
    }

    async function calculateDelayTime(stationId: number, currentStationLineKey: string, line: number | null): Promise<number> {
        // Only adds disruption delay for a given line once per route
        if (line === null) {
            return 0;
        }
        var disruptionDelay = 0;
        if (doesPathContainsLine(previousNodeMap, currentStationLineKey, line)) {
            const delayTime = fetchDisruptionTimeForLine(line);
            disruptionDelay += delayTime;
        }
        return disruptionDelay;
    }

    async function calculateTransferTime(stationId: number, currentLineId: number | null, connectingLineId: number | null): Promise<number> {
        const WALKING_CONNECTION_LINE_ID = 12;
        let transferTime = 0;
        if (currentLineId !== null && connectingLineId !== currentLineId) {
            if (!(currentLineId === WALKING_CONNECTION_LINE_ID || connectingLineId === WALKING_CONNECTION_LINE_ID) && connectingLineId !== null) {
                try {
                    transferTime = await tubeDatabase.retrieveTransferTime(stationId, currentLineId, connectingLineId);
                } catch (error) {
                    console.error('Error retrieving transfer time:', error);
                }
            }
        }
        return transferTime;
    }

    function createOptimalRouteOutput(destinationStationLineKey: string): optimalRouteResult {
        const stationLinePairsEvaluated = visitedNodes.size;
        const stationLinePairsInQueue = priorityQueue.size();
        const shortestPath = reconstructPath(previousNodeMap, destinationStationLineKey);
        const shortestPathStations = shortestPath.stationPath;
        const shortestPathLines = shortestPath.linePath;
        const totalTime = optimalTime.get(destinationStationLineKey)!;
        const optimalRoute: optimalRouteResult = {
            optimalStationSequence: shortestPathStations,
            optimizedLineSequence: shortestPathLines,
            totalTravelTime: totalTime,
            stationLinePairsEvaluated: stationLinePairsEvaluated,
            stationLinePairsInQueue: stationLinePairsInQueue
        };
        return optimalRoute;
    }

    return { optimalStationSequence: [], optimizedLineSequence: [], totalTravelTime: Infinity, stationLinePairsEvaluated: 0, stationLinePairsInQueue: 0 };
}




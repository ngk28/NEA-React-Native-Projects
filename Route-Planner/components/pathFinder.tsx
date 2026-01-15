import { fetchDisruptionTimeForLine } from '@/components/disruptionAPI';
import { tubeDatabase } from '@/components/tubeDatabase';
import { coordinate, neighbourStation, optimalRouteResult, routeKey, station } from '@/components/types';
import { PriorityQueue } from './priorityQueue';

// Store the most recently calculated path for quick access
let cachedOptimalRoute: optimalRouteResult | null = null;
let cachedRouteKey: routeKey | null = null;
let cachedPathStationDetails: Array<station> | null = null;

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

export function setCachedPath(path: optimalRouteResult) {
    if (cachedOptimalRoute === null) {
        cachedOptimalRoute = path;
    }
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

    const stationOnPathDetails: Array<station> = [];
    for (let i = 0; i < stationSequence.length; i++) {
        const stationDetail: station = {
            id: stationSequence[i],
            name: stationNames[i],
        };
        stationOnPathDetails.push(stationDetail);
    }

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
        return true;
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

    // Heuristics: Use real-life distance to estimate approximate time from start to destination
    var estimatedCost = HaversineDistance(fromStationCoordinate.latitude, fromStationCoordinate.longitude, toStationCoordinate.latitude, toStationCoordinate.longitude);

    // Initialize start state being from any line
    const startStateKey = `${fromStationId}-null`;
    previousNodeMap.set(startStateKey, null);
    optimalTime.set(startStateKey, 0);
    const startingStation: neighbourStation = {
        stationId: fromStationId,
        travelTime: estimatedCost,
        lineId: null
    }
    priorityQueue.enqueue(startingStation, estimatedCost);

    while (priorityQueue.size() > 0) {
        const current = priorityQueue.dequeue()!;

        // Skip if already processed this exact station-line combination
        const currentStationLineKey = `${current.stationId}-${current.lineId}`;
        if (visitedNodes.has(currentStationLineKey)) {
            continue;
        }
        visitedNodes.add(currentStationLineKey);

        // Optimal path found and exit
        if (current.stationId === toStationId) {
            const stationLinePairsEvaluated = visitedNodes.size;
            const stationLinePairsInQueue = priorityQueue.size();
            const shortestPath = reconstructPath(previousNodeMap, currentStationLineKey);
            const shortestPathStations = shortestPath.stationPath;
            const shortestPathLines = shortestPath.linePath;
            const totalTime = optimalTime.get(currentStationLineKey)!;
            return { optimalStationSequence: shortestPathStations, optimizedLineSequence: shortestPathLines, totalTravelTime: totalTime, stationLinePairsEvaluated, stationLinePairsInQueue };
        }

        const neighbours = await tubeDatabase.retrieveNeighbourStations(current.stationId);

        for (const neighbour of neighbours) {
            const station = neighbour.stationId;
            const line = neighbour.lineId;

            // Skip if already visited this specific station-line combination
            const neighbourStationLineKey = `${station}-${line}`;
            if (visitedNodes.has(neighbourStationLineKey)) {
                continue;
            }

            // Calculate future time/distance to destination
            const neighbourCoordinate: coordinate = await tubeDatabase.retrieveStationCoordinate(station);
            const estimateFutureTime = HaversineDistance(neighbourCoordinate.latitude, neighbourCoordinate.longitude, toStationCoordinate.latitude, toStationCoordinate.longitude);
            // Only adds disruption delay for a given line once per route
            var disruptionDelay = 0;
            if (doesPathContainsLine(previousNodeMap, currentStationLineKey, line)) {
                const delayTime = fetchDisruptionTimeForLine(line);
                disruptionDelay += delayTime;
            }

            // Current distance travelled + travel time to neighbour + disruption delay (no heuristics) 
            var calculatedTravelTime = optimalTime.get(currentStationLineKey)! + neighbour.travelTime + disruptionDelay;

            // If interchange, add transfer time (if not walking connection which is a transfer itself)
            const WALKING_CONNECTION_LINE_ID = 12;
            if (current.lineId !== null && line !== current.lineId) {
                if (!(current.lineId === WALKING_CONNECTION_LINE_ID || line === WALKING_CONNECTION_LINE_ID) && line !== null) {
                    try {
                        const transferTime = await tubeDatabase.retrieveTransferTime(current.stationId, current.lineId, line);
                        calculatedTravelTime += transferTime;
                    } catch (error) {
                        console.error('Error retrieving transfer time:', error);
                    }
                }
            }

            // New estimated time = tentative time + heuristic estimate to goal
            var newEstimatedTime = calculatedTravelTime + estimateFutureTime;
            const newNeighbourStation: neighbourStation = {
                stationId: station,
                travelTime: newEstimatedTime,
                lineId: line
            }
            priorityQueue.enqueue(newNeighbourStation, newEstimatedTime);
            if (!optimalTime.has(neighbourStationLineKey) || calculatedTravelTime < optimalTime.get(neighbourStationLineKey)!) {
                optimalTime.set(neighbourStationLineKey, calculatedTravelTime);
                previousNodeMap.set(neighbourStationLineKey, currentStationLineKey);
            }
        }
    }
    return { optimalStationSequence: [], optimizedLineSequence: [], totalTravelTime: Infinity, stationLinePairsEvaluated: 0, stationLinePairsInQueue: 0 };
}




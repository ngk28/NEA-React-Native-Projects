import { fetchDisruptionTimeForLine } from '@/components/disruptionAPI';
import { tubeDatabase } from '@/components/tubeDatabase';
import { adjacentStation, coordinate, optimalRouteResult, routeKey, station } from '@/components/types';
import { HashMap } from './hashMap';
import { PriorityQueue } from './priorityQueue';
import { StationSet } from './stationSet';

// Store the most recently calculated path for quick access
let cachedOptimalRoute: optimalRouteResult | null = null;
let cachedRouteKey: routeKey | null = null;
let cachedPathStationDetails: Array<station> | null = null;

// Converts latitude and longitude to distance in kilometres using the Haversine formula
function distanceBetweenCoordinates(coordinate1: coordinate, coordinate2: coordinate): number {
    const EARTH_RADIUS_IN_METRES = 6371e3;
    const theta1 = coordinate1.latitude * Math.PI / 180;
    const theta2 = coordinate2.latitude * Math.PI / 180;
    const deltaLat = (coordinate2.latitude - coordinate1.latitude) * Math.PI / 180;
    const deltaLong = (coordinate2.longitude - coordinate1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(theta1) * Math.cos(theta2) *
        Math.sin(deltaLong / 2) * Math.sin(deltaLong / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMetres = EARTH_RADIUS_IN_METRES * c;
    const distanceKilometres = distanceMetres / 1000;
    return distanceKilometres;
}

function calculateEstimatedTime(distanceInKilometres: number): number {
    const MINUTES_FOR_KILOMETRE = 1.3; // Approximate average time in minutes to travel 1 kilometre on London Underground
    return distanceInKilometres * MINUTES_FOR_KILOMETRE;
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

    const stationOnPathDetails: Array<station> = createStationDetail(stationNames, stationSequence);
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

function createStationDetail(stationNames: Array<string>, stationSequence: Array<number>): Array<station> {
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

async function formatStationAsNames(stationSequence: Array<number>): Promise<Array<string>> {
    const stationNames: Array<string> = [];
    for (const stationId of stationSequence) {
        const stationName = await tubeDatabase.retrieveStationName(stationId);
        stationNames.push(stationName);
    }
    return stationNames;
}

async function formatLinesAsNames(lineSequence: Array<number>): Promise<Array<string>> {
    const lineNames: Array<string> = [];
    for (const lineId of lineSequence) {
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
function isLineInPath(previousNodeMap: HashMap<adjacentStation, adjacentStation | null>, currentStation: adjacentStation, neighbourLine: number | null): boolean {
    if (neighbourLine === null) {
        return false;
    }
    let activeStation: adjacentStation | null = currentStation;
    while (activeStation !== null) {
        const previousLine = activeStation.lineId;
        if (previousLine === neighbourLine) {
            return true;
        }
        activeStation = previousNodeMap.get(activeStation) || null;
    }
    return false;
}

function reconstructPath(previousStation: HashMap<adjacentStation, adjacentStation | null>, destinationStation: adjacentStation): { stationSequence: number[], lineSequence: number[] } {
    const stationSequence: number[] = [];
    const lineSequence: number[] = [];

    let activeStation: adjacentStation | null = destinationStation;
    while (activeStation !== null) {
        const stationId = activeStation.stationId!;
        const lineId = activeStation.lineId;
        stationSequence.unshift(stationId);
        if (lineId !== null) {
            lineSequence.unshift(lineId);
        }
        activeStation = previousStation.get(activeStation) || null;
    }
    return { stationSequence, lineSequence };
}

// A* Search Algorithm Implementation
async function computeShortestPath(fromStationId: number, toStationId: number): Promise<optimalRouteResult> {
    const visitedNodes = new StationSet<adjacentStation>();
    const previousNode = new HashMap<adjacentStation, adjacentStation | null>();
    const optimalTime = new HashMap<adjacentStation, number>();
    let priorityQueue = new PriorityQueue<adjacentStation>();
    const fromStationCoordinate: coordinate = await tubeDatabase.retrieveStationCoordinate(fromStationId);
    const toStationCoordinate: coordinate = await tubeDatabase.retrieveStationCoordinate(toStationId);

    // Initialize starting station
    const startingStation: adjacentStation = {
        stationId: fromStationId,
        lineId: null,
    };
    previousNode.set(startingStation, null);
    optimalTime.set(startingStation, 0);
    var estimatedTimeToDestination = calculateEstimatedTime(distanceBetweenCoordinates(fromStationCoordinate, toStationCoordinate)); // Heuristics: Use real-life distance to estimate approximate time from start to destination
    // console.log(`Estimated time from starting station ID ${fromStationId} to destination: ${estimatedTimeToDestination.toFixed(2)} mins`);
    priorityQueue.enqueue(startingStation, estimatedTimeToDestination);

    while (priorityQueue.size() > 0) {
        const currentStation: adjacentStation = priorityQueue.dequeue()!;

        // Skip if already processed this exact station-line combination
        if (visitedNodes.has(currentStation)) {
            continue;
        }
        visitedNodes.add(currentStation);

        // Optimal path found and exit
        if (currentStation.stationId === toStationId) {
            const optimalRoute = createOptimalRouteOutput(currentStation);
            return optimalRoute;
        }

        const neighbours = await tubeDatabase.retrieveNeighbourStations(currentStation.stationId);
        for (var neighbourStation of neighbours) {
            const travelTimeToNeighbour = neighbourStation.travelTime!;
            neighbourStation.travelTime = undefined; // Remove travel time to avoid affecting set and hashmap keys 
            if (visitedNodes.has(neighbourStation)) { // Skip if already visited this specific station-line combination
                continue;
            }

            // Total time to neighbour - no heuristics: Distance travelled + travel time to neighbour + disruption delay + transfer time
            const transferTime = await calculateTransferTime(currentStation, neighbourStation);
            const disruptionDelay = await calculateDelayTime(currentStation, neighbourStation);
            var calculatedTimeToNeighbour = optimalTime.get(currentStation)! + travelTimeToNeighbour + disruptionDelay + transferTime;

            // Estimated remaining time - heuristic: Distance from neighbour to destination station using Haversine formula
            const neighbourCoordinate: coordinate = await tubeDatabase.retrieveStationCoordinate(neighbourStation.stationId);
            const estimatedTimeToDestination = calculateEstimatedTime(distanceBetweenCoordinates(neighbourCoordinate, toStationCoordinate));
            console.log(`Estimated time from station ID ${neighbourStation.stationId} to destination: ${estimatedTimeToDestination.toFixed(2)} mins`);

            // Total travel time = Calculated time from start to neighbour station + Estimated time from neighbour to destination station
            var totalEstimatedTravelTime = calculatedTimeToNeighbour + estimatedTimeToDestination;
            priorityQueue.enqueue(neighbourStation, totalEstimatedTravelTime);
            if (!optimalTime.has(neighbourStation) || calculatedTimeToNeighbour < optimalTime.get(neighbourStation)!) {
                optimalTime.set(neighbourStation, calculatedTimeToNeighbour);
                previousNode.set(neighbourStation, currentStation);
            }
        }
    }

    async function calculateDelayTime(currentStation: adjacentStation, neighbourStation: adjacentStation): Promise<number> {
        // Only adds disruption delay for a given line once per route
        const connectingLine = neighbourStation.lineId;
        if (connectingLine === null) {
            return 0;
        }
        var disruptionDelay = 0;
        if (!isLineInPath(previousNode, currentStation, connectingLine)) {
            const delayTime = fetchDisruptionTimeForLine(connectingLine);
            disruptionDelay += delayTime;
        }
        return disruptionDelay;
    }

    async function calculateTransferTime(currentStation: adjacentStation, nextStation: adjacentStation): Promise<number> {
        const WALKING_CONNECTION_LINE = 12;
        const currentLine = currentStation.lineId;
        const connectingLine = nextStation.lineId;
        const station = currentStation.stationId;

        let transferTime = 0;
        if (currentLine !== null && currentLine !== connectingLine) {
            if (!(currentLine === WALKING_CONNECTION_LINE || connectingLine === WALKING_CONNECTION_LINE) && connectingLine !== null) {
                try {
                    transferTime = await tubeDatabase.retrieveTransferTime(station, currentLine, connectingLine);
                } catch (error) {
                    console.error('Error retrieving transfer time:', error);
                }
            }
        }
        return transferTime;
    }

    function createOptimalRouteOutput(destinationStation: adjacentStation): optimalRouteResult {
        const stationLinePairsEvaluated = visitedNodes.size();
        const stationLinePairsInQueue = priorityQueue.size();
        const shortestPath = reconstructPath(previousNode, destinationStation);
        const shortestPathStations = shortestPath.stationSequence;
        const shortestPathLines = shortestPath.lineSequence;
        const totalTime = optimalTime.get(destinationStation)!;
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
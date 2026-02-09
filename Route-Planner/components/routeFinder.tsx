import { tubeDatabase, TubeDatabase } from '@/components/tubeDatabase';
import { AdjacentStation, OptimalRouteResult, RouteQuery, Station } from '@/components/types';
import { HashTable } from './hashTable';
import { PriorityQueue } from './priorityQueue';
import { VisitedStationSet } from './set';
import {
    fetchTransferTime, estimateTimeBetweenStations, calculateDisruptionDelay, buildRouteStationDetails
} from './routeFinderHelper';

// Stores the most recently calculated optimal path for quick access
let cachedOptimalRouteResult: OptimalRouteResult | null = null;
let cachedRouteIdentifier: RouteQuery | null = null;
let storedRouteStationList: Array<Station> | null = null;

// Function that implements the A* algorithm to find the optimal route between two stations
async function computeOptimalRoute(fromStationId: number, toStationId: number): Promise<OptimalRouteResult> {
    // Creates data structures used in A* algorithm implementation
    const visitedStationLinePairs = new VisitedStationSet<AdjacentStation>();
    const previousStation = new HashTable<AdjacentStation, AdjacentStation | null>();
    const timeToStation = new HashTable<AdjacentStation, number>();
    // Priority is based on estimated total travel time from start to destination station (calculated travel time from start to current station + heuristic estimated time from current station to destination)
    let priorityQueue = new PriorityQueue<AdjacentStation>();

    // Initialize starting station
    const startingStation: AdjacentStation = {
        stationId: fromStationId,
        lineId: null,
        travelTime: 0
    };
    previousStation.set(startingStation, null);
    timeToStation.set(startingStation, 0);

    // Adds starting station to queue with estimated time to destination 
    var estimatedTimeToDestination = await estimateTimeBetweenStations(fromStationId, toStationId);
    priorityQueue.enqueue(startingStation, estimatedTimeToDestination);

    // Loops through station-line pairs in priority queue until destination reached
    while (priorityQueue.size() > 0) {
        // Dequeues station-line pair with lowest estimated total travel time
        const currentStation: AdjacentStation = priorityQueue.dequeue()!;

        // Skips processing station-line pair if already processed 
        if (visitedStationLinePairs.has(currentStation)) {
            continue;
        }
        visitedStationLinePairs.add(currentStation);

        // Optimal path found so exits loop, returning optimal route result 
        if (currentStation.stationId === toStationId) {
            const optimalRoute = buildOptimalRouteResult(currentStation);
            return optimalRoute;
        }

        // Retrieves neighbour stations for current station
        const neighbours = await tubeDatabase.retrieveNeighbourStations(currentStation.stationId);

        // Loops through each neighbour station to update queue 
        for (var neighbourStation of neighbours) {
            // Skip if already visited this specific station-line combination
            if (visitedStationLinePairs.has(neighbourStation)) {
                continue;
            }

            // Total time to neighbour - no heuristics: Time already travelled + travel time to neighbour + disruption delay + transfer time
            const transferTime = await fetchTransferTime(currentStation, neighbourStation);
            const disruptionDelay = await calculateDisruptionDelay(currentStation, neighbourStation, previousStation);
            var calculatedTimeToNeighbour = timeToStation.get(currentStation)! + neighbourStation.travelTime + disruptionDelay + transferTime;

            // If this path to neighbour station is shorter than any previously known path or neighbour station not yet in queue
            if (!timeToStation.has(neighbourStation) || calculatedTimeToNeighbour < timeToStation.get(neighbourStation)!) {
                // Estimated Remaining Travel Time - heuristics: Travel time from neighbour to destination station
                const estimatedTimeToDestination = await estimateTimeBetweenStations(neighbourStation.stationId, toStationId);

                // Total Travel Time = Calculated time from start to neighbour station + Estimated time from neighbour to destination station
                var totalEstimatedTravelTime = calculatedTimeToNeighbour + estimatedTimeToDestination;

                // Adds neighbour station to queue with priority based on total estimated travel time from start to destination station
                priorityQueue.enqueue(neighbourStation, totalEstimatedTravelTime);

                // Updates time and previous node to neighbour station 
                timeToStation.set(neighbourStation, calculatedTimeToNeighbour);
                previousStation.set(neighbourStation, currentStation);
            }
        }
    }

    // Returns empty result with infinite travel time if no path found to avoid app crash
    return { stationSequence: [], lineSequence: [], totalTravelTime: Infinity, stationLinePairsEvaluated: 0, stationLinePairsInQueue: 0 };

    // Helper function that builds optimal route result object once destination is reached
    function buildOptimalRouteResult(destinationStation: AdjacentStation): OptimalRouteResult {
        // Retreieves diagnostic information for optimal route result
        const stationLinePairsEvaluated = visitedStationLinePairs.size();
        const stationLinePairsInQueue = priorityQueue.size();

        // Reconstructs optimal path by backtracking from destination to start using previousNodeMap
        const shortestPath = backtrackNodesVisited(previousStation, destinationStation);
        const shortestPathStations = shortestPath.stationSequence;
        const shortestPathLines = shortestPath.lineSequence;
        const totalTime = timeToStation.get(destinationStation)!;

        // Builds and returns optimal route result object
        const optimalRoute: OptimalRouteResult = {
            stationSequence: shortestPathStations,
            lineSequence: shortestPathLines,
            totalTravelTime: totalTime,
            stationLinePairsEvaluated: stationLinePairsEvaluated,
            stationLinePairsInQueue: stationLinePairsInQueue
        };
        return optimalRoute;
    }
}

// Function that returns cached path without recomputation, catches null error if no cached path available
function retrieveCachedOptimalRoute(): OptimalRouteResult {
    try {
        if (cachedOptimalRouteResult === null) {
            throw new Error('No cached path available.');
        }
    } catch (error) {
        console.error('Error retrieving cached path:', error);
        throw error;
    }
    return cachedOptimalRouteResult;
}

// Function that returns cached path station details, catches null error
export function retrieveCachedRouteStations(): Array<Station> {
    try {
        if (storedRouteStationList === null) {
            throw new Error('No cached route station details available.');
        }
    } catch (error) {
        console.error('Error retrieving cached route station details:', error);
        throw error;
    }
    return storedRouteStationList;
}

// Function that returns transfer stations on the optimal route with their details
export async function retrieveTransferStations(): Promise<Array<Station>> {
    const stationDetails = await retrieveCachedRouteStations();
    const transferStations = stationDetails.filter((stations) => stations.fromLineName !== stations.toLineName);
    return transferStations;
}

// async function fetchRouteStationDetails(): Promise<Array<Station>> {
//     // If cached station details exist and route key matches, returns cached station details as no need to recompute
//     const routeKey: RouteQuery = {
//         fromStationId: route.stationSequence[0],
//         toStationId: route.stationSequence[route.stationSequence.length - 1]
//     };
//     if (storedRouteStationList !== null && cachedRouteIdentifier !== null && cachedRouteIdentifier === routeKey) {
//         return getCachedRouteStations();
//     }

// }

// Function that initiates and exports optimal route calculation
export async function retrieveOptimalRoute(fromStationId: number, toStationId: number): Promise<OptimalRouteResult> {
    // Tries to use cached path if available and route key matches
    const segment: RouteQuery = {
        fromStationId: fromStationId,
        toStationId: toStationId
    };
    if (cachedOptimalRouteResult !== null && cachedRouteIdentifier !== null && cachedRouteIdentifier === segment) {
        return retrieveCachedOptimalRoute();
    }

    // Computes optimal route as no cached result available
    // Caches optimal route result and station details 
    const shortestPath = await computeOptimalRoute(fromStationId, toStationId);
    cachedOptimalRouteResult = shortestPath;

    // Builds station details for optimal route, easier to access and display stations on map
    const generatedStationDetails = await buildRouteStationDetails(shortestPath);
    storedRouteStationList = generatedStationDetails;
    cachedRouteIdentifier = segment;

    // Diagnostic logs
    // console.log('From station ID:', fromStationId, 'To station ID:', toStationId);
    // console.log('Station-line pairs visited:', result.stationLinePairsEvaluated);
    // console.log('Station-line pairs in queue:', result.stationLinePairsInQueue);
    // console.log('Shortest path (stations):', result.optimalStationSequence, 'Total time:', result.totalTime);
    // console.log('Shortest path (names):', await getStationNames(shortestPath.optimalStationSequence));
    // console.log('Shortest path (lines):', result.optimizedLineSequence);
    // console.log('Shortest path (line names):', await getLineNames(shortestPath.optimizedLineSequence));

    return shortestPath;
}

// Function that retraces path from destination to start station using previousNodeMap
function backtrackNodesVisited(previousStation: HashTable<AdjacentStation, AdjacentStation | null>, destinationStation: AdjacentStation): { stationSequence: number[], lineSequence: number[] } {
    // Creates arrays to store station and line sequences for optimal path
    const stationSequence: number[] = [];
    const lineSequence: number[] = [];

    let activeStation: AdjacentStation | null = destinationStation;

    // Loops until start station reached (previous node is null)
    while (activeStation !== null) {
        // Extracts station and line IDs for current station
        const stationId = activeStation.stationId;
        const lineId = activeStation.lineId;

        // Adds station and line IDs to sequence
        stationSequence.unshift(stationId);

        // Adds line ID to sequence if not null
        if (lineId !== null) {
            lineSequence.unshift(lineId);
        }

        // Moves to previous station on path
        activeStation = previousStation.get(activeStation) || null;
    }

    // Returns object containing station and line sequences for optimal path
    return { stationSequence, lineSequence };
}


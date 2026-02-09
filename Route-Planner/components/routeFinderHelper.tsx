import { tubeDatabase } from '@/components/tubeDatabase';
import { AdjacentStation, Coordinate, OptimalRouteResult, Station } from '@/components/types';
import { HashTable } from './hashTable';
import { fetchDisruptionTimeForLine } from './serviceStatus';

// Function that calculates distance between points on Earth using the Haversine formula
function getDistanceBetweenCoordinatesKm(coordinate1: Coordinate, coordinate2: Coordinate): number {
    const EARTH_RADIUS_IN_METRES = 6371e3;
    const latitude1InRadians = coordinate1.latitude * Math.PI / 180;
    const latitude2InRadians = coordinate2.latitude * Math.PI / 180;
    const latitudeDifference = (coordinate2.latitude - coordinate1.latitude) * Math.PI / 180;
    const longitudeDifference = (coordinate2.longitude - coordinate1.longitude) * Math.PI / 180;

    const length = Math.sin(latitudeDifference / 2) * Math.sin(latitudeDifference / 2) +
        Math.cos(latitude1InRadians) * Math.cos(latitude2InRadians) *
        Math.sin(longitudeDifference / 2) * Math.sin(longitudeDifference / 2);
    const angle = 2 * Math.atan2(Math.sqrt(length), Math.sqrt(1 - length));
    const distanceMetres = EARTH_RADIUS_IN_METRES * angle;
    const distanceKilometres = distanceMetres / 1000;
    return distanceKilometres;
}

// Function that converts calculated distance to estimated travel time 
export async function estimateTimeBetweenStations(fromStationId: number, toStationId: number): Promise<number> {
    // Average time in minutes to travel 1 kilometre on London Underground
    const MINUTES_PER_KILOMETRE = 1.3;

    // Retrieves coordinates for both stations
    const fromStationCoordinate = await tubeDatabase.retrieveStationCoordinate(fromStationId);
    const toStationCoordinate = await tubeDatabase.retrieveStationCoordinate(toStationId);

    // Estimates travel time between stations
    const distanceKm = getDistanceBetweenCoordinatesKm(fromStationCoordinate, toStationCoordinate);
    const estimatedTime = distanceKm * MINUTES_PER_KILOMETRE;
    return estimatedTime;
}

// Function that retrieves transfer time between lines at a station
export async function fetchTransferTime(currentStation: AdjacentStation, nextStation: AdjacentStation): Promise<number> {
    // Walking connections (lineId 12) does not have an additional transfer time
    const WALKING_CONNECTION_LINE = 12;

    // Extract line and station IDs for current and neighbour station
    const currentLine = currentStation.lineId;
    const connectingLine = nextStation.lineId;
    const stationId = currentStation.stationId;

    let transferTime = 0;

    // If there is a line change (and not walking connection), retrieves transfer time from database
    if (currentLine !== null && connectingLine !== null && currentLine !== connectingLine) {
        if (!(currentLine === WALKING_CONNECTION_LINE || connectingLine === WALKING_CONNECTION_LINE)) {
            try {
                transferTime = await tubeDatabase.retrieveTransferTime(stationId, currentLine, connectingLine);
            } catch (error) {
                console.error('Error retrieving transfer time:', error);
            }
        }
    }
    return transferTime;
}

// Function that calculates disruption delay for a station-line pair based on current path 
// Only adds disruption delay once for a given line, even if multiple stations disrupted on the same line
export async function calculateDisruptionDelay(currentStation: AdjacentStation, neighbourStation: AdjacentStation, previousNodeMap: HashTable<AdjacentStation, AdjacentStation | null>): Promise<number> {
    // Extract line ID for neighbour station, check for null if its the starting station with no incoming line
    const connectingLine = neighbourStation.lineId;
    if (connectingLine === null) {
        return 0;
    }

    // If line not already in path, retrieves and returns disruption delay for line
    if (!isLineInVisitedPath(previousNodeMap, currentStation, connectingLine)) {
        const delayTime = await fetchDisruptionTimeForLine(connectingLine);
        return delayTime;
    }

    // If line already present in path, then no need to add disruption delay again
    return 0;
}

// Function that checks if line is already present in path 
// Ensures disruption time is only added once per line, even if multiple stations on same line
function isLineInVisitedPath(previousNodeMap: HashTable<AdjacentStation, AdjacentStation | null>, currentStation: AdjacentStation, lineToNeighbour: number | null): boolean {
    // If line to neighbour is null (possible for starting station with no incoming line), then returns false
    if (lineToNeighbour === null) {
        return false;
    }

    let activeStation: AdjacentStation | null = currentStation;

    // Iterates backwards from current station to starting station
    while (activeStation !== null) {
        // Checks if a previously visited line matches the line to neighbour
        const visitedLine = activeStation.lineId;

        // If line to neighbour already present in path, then returns true
        if (visitedLine === lineToNeighbour) {
            return true;
        }

        // Moves to previous station in path
        activeStation = previousNodeMap.get(activeStation) || null;
    }
    return false;
}

// Function that generates a list of stations with all their corresponding details for the optimal route
export async function buildRouteStationDetails(route: OptimalRouteResult): Promise<Array<Station>> {
    // Retrieves route details
    const stationSequence = route.stationSequence;
    const lineSequence = route.lineSequence;

    // Creates array of station details for stations on route
    const stationOnPathDetails: Array<Station> = await buildStationDetails(stationSequence);

    // Adds line names and coordinates to station details
    await addLineNamesToStations(stationOnPathDetails, lineSequence, stationSequence);
    await addCoordinatesToStations(stationOnPathDetails);

    return stationOnPathDetails;
}

// Function that builds station objects from names and sequence
async function buildStationDetails(stationSequence: Array<number>): Promise<Array<Station>> {
    const stationNames = await fetchStationNames(stationSequence);

    const stationDetails: Array<Station> = [];
    for (let i = 0; i < stationSequence.length; i++) {
        const stationDetail: Station = {
            id: stationSequence[i],
            name: stationNames[i],
        };
        stationDetails.push(stationDetail);
    }
    return stationDetails;
}

// Function that adds coordinates to station details
async function addCoordinatesToStations(stationDetails: Array<Station>) {
    try {
        for (let i = 0; i < stationDetails.length; i++) {
            const stationCoordinate: Coordinate = await tubeDatabase.retrieveStationCoordinate(stationDetails[i].id);
            stationDetails[i].latitude = stationCoordinate.latitude;
            stationDetails[i].longitude = stationCoordinate.longitude;
        }
    } catch (error) {
        console.error('Error adding coordinates to station list:', error);
    }
}

// Function that adds line names to station details
async function addLineNamesToStations(stationDetails: Array<Station>, lineSequence: Array<number>, stationSequence: Array<number>) {
    try {
        // Loops through stations on route
        for (let i = 0; i < stationDetails.length; i++) {
            // If not first station, then adds fromLine name (first station fromLine = null) 
            if (i !== 0) {
                const fromLineId = lineSequence[i - 1];
                const fromLineName = await tubeDatabase.retrieveLineName(fromLineId);
                stationDetails[i].fromLineName = fromLineName;
            }

            // If not last station, then adds toLine name (last station toLine = null)
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

// Function that converts sequence of station IDs to station names
export async function fetchStationNames(stationSequence: Array<number>): Promise<Array<string>> {
    const stationNames: Array<string> = [];
    for (const stationId of stationSequence) {
        const stationName = await tubeDatabase.retrieveStationName(stationId);
        stationNames.push(stationName);
    }
    return stationNames;
}

// Function that converts sequence of line IDs to line names
export async function fetchLineNames(lineSequence: Array<number>): Promise<Array<string>> {
    const lineNames: Array<string> = [];
    for (const lineId of lineSequence) {
        const lineName = await tubeDatabase.retrieveLineName(lineId);
        lineNames.push(lineName);
    }
    return lineNames;
}
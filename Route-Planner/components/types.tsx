// Represents a station and its associated route information
// Line Names are optional as they are null for the first and last stations on a route
// Coordinates are optional as they are only added to station details afterwards 
export interface Station {
    id: number;
    name: string;
    fromLineName?: string | null;
    toLineName?: string | null;
    latitude?: number;
    longitude?: number;
};

// Represents a connection to a neighbouring station 
// Line ID is null for starting station
export interface AdjacentStation {
    stationId: number;
    lineId: number | null;
    travelTime: number;
};

// Represents a route search query between 2 stations
// Station Names added later for display purposes
export interface RouteQuery {
    fromStationId: number;
    toStationId: number;
    fromStationName?: string;
    toStationName?: string;
};

// Represents optimal route  returned from A* algorithm
export interface OptimalRouteResult {
    stationSequence: number[];
    lineSequence: number[];
    totalTravelTime: number;
    stationLinePairsEvaluated: number;
    stationLinePairsInQueue: number;
};

// Represents station coordinates 
export interface Coordinate {
    longitude: number;
    latitude: number;
};

// Represents coordinate range passed to map interface to determine map zoom level and center
export interface CoordinateRange {
    minLongitude: number;
    minLatitude: number;
    maxLongitude: number;
    maxLatitude: number;
};

// Represents line status information retrieved from TfL API
export interface LineStatus {
    lineName: string;
    lineId: number;
    status: string;
    severity: number;
    reason: string;
    delayMinutes: number;
};
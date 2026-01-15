export type station = {
    id: number;
    name: string;
    fromLineName?: string | null;
    toLineName?: string | null;
    latitude?: number;
    longitude?: number;
};
export type neighbourStation = {
    stationId: number;
    lineId: number | null;
    travelTime: number;
};
export type segmentKey = {
    fromStationId: number;
    toStationId: number;
    fromStationName?: string;
    toStationName?: string;
};
export type routeKey = {
    fromStationId: number;
    toStationId: number;
};
export type optimalRouteResult = {
    optimalStationSequence: number[];
    optimizedLineSequence: number[];
    totalTravelTime: number;
    stationLinePairsEvaluated: number;
    stationLinePairsInQueue: number;
};
export type coordinate = {
    longitude: number;
    latitude: number;
};
export type coordinateRange = {
    minLongitude: number;
    minLatitude: number;
    maxLongitude: number;
    maxLatitude: number;
};
export type searchHistoryEntry = {
    fromStationName: string;
    toStationName: string;
    fromStationId: number;
    toStationId: number;
};
export type disruptionEvent = {
    lineName: string;
    lineId: number;
    status: string;
    severity: number;
    reason: string;
    timeDelay: number;
};
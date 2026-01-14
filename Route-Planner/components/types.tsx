

export type station = {
    stationId: number;
    stationName: string;
};
export type pathKey = {
    fromStationId: number;
    toStationId: number;
    fromStationName: string;
    toStationName: string;
};

export type pathFinderResult = {
    optimalStationSequence: number[];
    optimizedLineSequence: number[];
    totalTime: number;
    stationLinePairsEvaluated: number;
    stationLinePairsInQueue: number;
};

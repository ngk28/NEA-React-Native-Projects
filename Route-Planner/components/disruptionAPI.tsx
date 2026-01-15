import { tubeDatabase } from "./tubeDatabase";
import { disruptionEvent } from "./types";

const API_KEY = '1a771aa56d4743848a262e4d2160b34f';
const DISRUPTION_FETCH_TIMEOUT_IN_SECONDS = 7;
const severityLevelTime: { [severity: number]: number } = {
    // Convert TFL API severity levels to estimated delay times in minutes
    10: 0,   // Good Service
    9: 15,   // Minor Delays
    6: 30,  // Severe Delays
    5: 60,  // Part Suspended
}

let cachedDisruptionData: Array<disruptionEvent> | null = null;
let lastFetchTime: Date | null = null;

export async function retrieveDisruptions() {
    try {
        const disruptionResponse = await queryDisruptionAPI();
        const disruptions = await parseDisruptionResponse(disruptionResponse);

        if (disruptions.length === 0) {
            throw new Error(`No disruption data available.`);
        }

        lastFetchTime = new Date();
        console.log(`New disruption data fetched at ${lastFetchTime.toISOString()}`);
        cachedDisruptionData = disruptions;
        return disruptions;
    } catch (error) {
        if (cachedDisruptionData && cachedDisruptionData.length > 0) {
            // Use cached data if available
            return cachedDisruptionData;
        }
        return [];
    }
}

async function queryDisruptionAPI() {
    const url = 'https://api.tfl.gov.uk/Line/Mode/tube/Status';
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), DISRUPTION_FETCH_TIMEOUT_IN_SECONDS * 1000); // Timeout for fetch request
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'app_key': API_KEY,
            },
            signal: timeoutController.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Disruption API failed with ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error: any) {
        clearTimeout(timeout);
        const isAborted = (timeoutController.signal.aborted || error?.name === 'AbortError');
        const isNetworkError = (error instanceof Error && error.message === 'Network request failed');

        if (isAborted || isNetworkError) {
            if (isAborted) {
                console.warn('Disruption fetch aborted (timeout).');
            } else {
                console.warn('Disruption fetch failed: Network request failed.');
            }
            return;
        }
        throw error;
    }
}

async function parseDisruptionResponse(data: any[]): Promise<Array<disruptionEvent>> {
    if (!data) {
        return [];
    }
    try {
        const disruptions: Array<disruptionEvent> = [];
        for (const disruption of data) {
            const disruptionLineId = await tubeDatabase.retrieveLineId(disruption.name);
            const disruptionSeverity = disruption.lineStatuses[0].statusSeverity;
            const disruptionTime = severityLevelTime[disruptionSeverity];
            const disruptionEvent: disruptionEvent = {
                lineName: disruption.name,
                lineId: disruptionLineId,
                severity: disruptionSeverity || 0,
                status: disruption.lineStatuses[0].statusSeverityDescription || 'Unknown',
                reason: disruption.lineStatuses[0].reason || 'No details provided',
                timeDelay: disruptionTime || 0,
            };
            disruptions.push(disruptionEvent);
        }
        return disruptions;
    } catch (error) {
        console.error('Error parsing disruptions:', error);
        throw error;
    }
}

export function fetchDisruptionTimeForLine(lineId: number | null): number {
    if (!cachedDisruptionData || lineId === null) {
        return 0;
    }
    for (const disruption of cachedDisruptionData) {
        if (disruption.lineId === lineId) {
            return disruption.timeDelay || 0;
        }
    }
    return 0;
}

export function getLastDisruptionFetchTime(): Date | null {
    return lastFetchTime;
}
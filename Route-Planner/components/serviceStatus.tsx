import { tubeDatabase } from "./tubeDatabase";
import { LineStatus } from "./types";

// TfL API key 
const API_KEY = '1a771aa56d4743848a262e4d2160b34f';

// Timeout for fetching disruption data, prevents long waits in case of network issues or unresponsive API
const STATUS_FETCH_TIMEOUT_MS = 7000;

// Convert TfL API severity levels to estimated delay times in minutes
const severityToDelayMinutes: { [severity: number]: number } = {
    10: 0,   // Good Service
    9: 10,   // Minor Delays
    6: 30,  // Severe Delays
    5: 60,  // Part Suspended
}

// Caches and stores Tube service status and timestamp of last fetch
let cachedStatusData: Array<LineStatus> | null = null;
let lastFetchTime: Date | null = null;

// Function that fetches Tube service status from external API, caches data and handles errors 
async function queryTubeServiceAPI() {
    // API endpoint for Tube service status
    const url = 'https://api.tfl.gov.uk/Line/Mode/tube/Status';

    // AbortController handles fetch timeout, ensures app remains responsive even if the API is unresponsive
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), STATUS_FETCH_TIMEOUT_MS);

    try {
        // Fetches data from API
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'app_key': API_KEY,
            },
            signal: timeoutController.signal,
        });

        // Checks if response was successful, if API returns error, then caught in catch block
        if (!response.ok) {
            throw new Error(`Service Status API failed with ${response.status}`);
        }

        // Parses and returns data in JSON format
        const apiResponseData = await response.json();
        return apiResponseData;
    } catch (error: any) {
        // Distinguishes between different types of errors for better debugging
        const isAborted = (timeoutController.signal.aborted || error?.name === 'AbortError');
        const isNetworkError = (error instanceof Error && error.message === 'Network request failed');
        if (isAborted || isNetworkError) {
            if (isAborted) {
                console.warn('Service Status fetch aborted (timeout).');
            } else {
                console.warn('Service Status fetch failed: Network request failed.');
            }
            return;
        }
        throw error;
    } finally {
        // Resets timer for next fetch
        clearTimeout(timeout);
    }
}

// Function that parses API response and converts it to LineStatus objects
async function parseStatusResponse(apiResponseData: any[]): Promise<Array<LineStatus>> {
    // If no data returned, it signifies network error and returns empty array to avoid app crashes
    if (!apiResponseData || apiResponseData.length === 0) {
        return [];
    }

    try {
        const tubeStatus: Array<LineStatus> = [];
        for (const lineData of apiResponseData) {
            // Retrieves line ID and disruption severity
            const lineId = await tubeDatabase.retrieveLineId(lineData.name);
            const severityLevel = lineData.lineStatuses[0].statusSeverity;

            // Converts severity to estimated delay time using severityToDelayMinutes mapping
            const delayMinutes = severityToDelayMinutes[severityLevel];

            // Creates LineStatus object for each line based on API response 
            const lineStatus: LineStatus = {
                lineName: lineData.name,
                lineId: lineId,
                severity: severityLevel || 0,
                status: lineData.lineStatuses[0].statusSeverityDescription || 'Unknown',
                reason: lineData.lineStatuses[0].reason || 'No details provided',
                delayMinutes: delayMinutes || 0,
            };

            // Adds status event to tubeStatus array
            tubeStatus.push(lineStatus);
        }
        return tubeStatus;
    } catch (error) {
        console.error('Error parsing line statuses:', error);
        throw error;
    }
}

// Function that updates and fetches all line status, uses cached data if API fetch fails  
export async function fetchTubeStatusService() {
    try {
        // Fetches and parses new data from API  
        const statusResponse = await queryTubeServiceAPI();
        const tubeStatus = await parseStatusResponse(statusResponse);

        // If API returns no data, it signifies network error
        if (tubeStatus.length === 0) {
            throw new Error(`No new status data available.`);
        }

        // Updates cache and timestamp if fetch successful
        lastFetchTime = new Date();
        console.log(`New disruption data fetched at ${lastFetchTime.toISOString()}`);
        cachedStatusData = tubeStatus;
        return tubeStatus;
    } catch (error) {
        // Uses cached data if available
        if (cachedStatusData && cachedStatusData.length > 0) {
            return cachedStatusData;
        }

        // If no cached data, returns empty array to avoid app crashes
        return [];
    }
}

// Function that retrieves disruption delay for a specific line from cached status data
export function fetchDisruptionTimeForLine(lineId: number | null): number {
    // Returns 0 delay if no cached data or lineId is null
    if (!cachedStatusData || lineId === null) {
        return 0;
    }

    // Searches cached status data for disruption matching lineId, returns delay time if found
    for (const lineStatus of cachedStatusData) {
        if (lineStatus.lineId === lineId) {
            return lineStatus.delayMinutes || 0;
        }
    }
    return 0;
}

// Function that returns timestamp of last successful status fetch, used to determine if data is outdated
export function retrieveLastStatusFetchTime(): Date | null {
    return lastFetchTime;
}
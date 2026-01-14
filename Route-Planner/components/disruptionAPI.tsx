// https://api-portal.tfl.gov.uk/api-details#api=Line&operation=Line_StatusByModeByPathModesQueryDetailQuerySeverityLevel

import { Database } from "./database";

const API_KEY = '1a771aa56d4743848a262e4d2160b34f';

async function queryDisruptionAPI() {
    const url = 'https://api.tfl.gov.uk/Line/Mode/tube/Status';
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'app_key': API_KEY,
            },
        });
        const data = await response.json();
        console.log(`Disruptions fetched at ${new Date()}`);
        return data;
    } catch (error) {
        console.error('Error fetching disruptions:', error);
        throw error;
    }
}
export type disruptionEvent = {
    lineName: string;
    lineId: number;
    status: string;
    severity: number;
    reason: string;
    timeDelay: number | null;
};
const severityLevelTime: { [severity: number]: number } = {
    // Convert TFL severity levels to estimated delay times in minutes
    10: 0,   // Good Service
    9: 5,   // Minor Delays
    6: 20,  // Severe Delays
    5: 30,  // Part Suspended
}
let cachedDisruptionData: Array<disruptionEvent> | null = null;
let lastFetchTime: Date | null = null;


export async function fetchDisruptionTimeForLine(lineId: number): Promise<number> {
    if (!cachedDisruptionData) {
        return 0;
    }
    const disruptionEvent = cachedDisruptionData.find(event => event.lineId === lineId);
    if (!disruptionEvent) {
        return 0;
    }
    const lineSeverityCode = disruptionEvent.severity;
    const disruptionTime = severityLevelTime[lineSeverityCode];
    return disruptionTime || 0;
}

async function parseDisruptionResponse(data: any[]): Promise<Array<disruptionEvent>> {
    if (!data) {
        console.log('No disruption data available.');
        return [];
    }
    try {
        const disruptions: Array<disruptionEvent> = [];
        for (const disruption of data) {
            const disruptionLineId = await Database.retrieveLineId(disruption.name);
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
        console.error('Error retrieving disruptions:', error);
        throw error;
    }
}

export function getLastDisruptionFetchTime(): Date | null {
    return lastFetchTime;
}

export async function retrieveDisruptions() {
    try {
        const disruptionResponse = await queryDisruptionAPI();
        const disruptions = await parseDisruptionResponse(disruptionResponse);

        if (disruptions.length === 0) {
            console.log(`No disruption data available at ${new Date()}`);
            return [];
        }

        lastFetchTime = new Date();
        cachedDisruptionData = disruptions;
        return disruptions;
    } catch (error) {
        console.error('Error retrieving disruptions:', error);
        throw error;
    }
}
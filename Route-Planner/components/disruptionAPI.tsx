// https://api-portal.tfl.gov.uk/api-details#api=Line&operation=Line_StatusByModeByPathModesQueryDetailQuerySeverityLevel



async function queryDisruptionAPI() {
    const url = 'https://api.tfl.gov.uk/Line/Mode/tube/Status';
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            },
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching disruptions:', error);
        throw error;
    }
}
export type disruptionEvent = {
    lineName: string;
    status: string;
    severity: number;
    reason: string;
};
async function parseRetrievedDisruptions(data: any[]): Promise<Array<disruptionEvent>> {
    if (!data) {
        console.log('No disruption data available.');
        return [];
    }
    try {
        const disruptions: Array<disruptionEvent> = data.map((item: any) => ({
            lineName: item.name,
            status: item.lineStatuses[0].statusSeverityDescription || 'Unknown',
            severity: item.lineStatuses[0].statusSeverity || 0,
            reason: item.lineStatuses[0].reason || 'No details provided',
        }));
        return disruptions;
    } catch (error) {
        console.error('Error retrieving disruptions:', error);
        throw error;
    }
}

export async function retrieveDisruptions() {
    try {
        const disruptionResponse = await queryDisruptionAPI();
        const disruptions = await parseRetrievedDisruptions(disruptionResponse);
        let timeFetch = new Date().toLocaleString();
        console.log(`Disruptions retrieved at ${timeFetch}`);
        return disruptions;
    } catch (error) {
        console.error('Error retrieving disruptions:', error);
        throw error;
    }
}
import { CoordinateRange, OptimalRouteResult } from '@/components/types';
import * as GeoJSON from 'geojson';
import tubePolylines from '../assets/tubeLines.json';
import { tubeDatabase } from './tubeDatabase';

// London Underground line colours
const LINE_COLOURS_MAP: { [lineName: string]: string } = {
    'Bakerloo': '#B26300',
    'Central': '#DC241F',
    'Circle': '#FFC80A',
    'District': '#007D33',
    'Hammersmith & City': '#F589A6',
    'Jubilee': '#838D93',
    'Metropolitan': '#9B0058',
    'Northern': '#000000',
    'Piccadilly': '#0019A8',
    'Victoria': '#039BE5',
    'Waterloo & City': '#76D0BD',
    'Interchange - Walking': '#5E3D3D',
};


// Function that retrieves all polylines needed to draw a given route
export async function generateRoutePolyline(optimalRoute: OptimalRouteResult): Promise<GeoJSON.FeatureCollection> {
    // Creates array to store polylines for entire route
    const routeFeatures: GeoJSON.Feature[] = [];

    // Extracts station and line sequences from result for optimal route
    const stations = optimalRoute.stationSequence;
    const lines = optimalRoute.lineSequence;

    // Loops through each pair of consecutive stations in route
    for (let i = 0; i < stations.length - 1; i++) {
        // Gets station IDs and line ID for each segment
        const fromStationId = stations[i];
        const toStationId = stations[i + 1];
        const lineId = lines[i];

        try {
            // Finds GeoJSON features representing this station-to-station segment
            const featuresForSegment = await findSegmentFeatures(fromStationId, toStationId, lineId);

            // If features found, adds them to overall route features array, otherwise log warning
            if (featuresForSegment) {
                routeFeatures.push(...featuresForSegment);
            } else {
                console.warn('No GeoJSON segment found for', { fromStationId, toStationId, lineId });
            }
        } catch (error) {
            console.error('Failed to find segment', { fromStationId, toStationId, lineId, error });
        }
    }

    // Returns GeoJSON for entire route, ready for rendering on map
    return { type: 'FeatureCollection', features: routeFeatures };
}

// Function that finds GeoJSON feature(s) for a segment (adjacent stations) defined by station IDs and line ID
async function findSegmentFeatures(fromStationId: number, toStationId: number, lineId: number): Promise<GeoJSON.Feature[] | null> {
    // GeoJSON file uses Naptan IDs (rather than station IDs) and line name (rather than line Id) to identify segments
    // Retrieves Naptan IDs for given stations 
    const fromNaptanId = await tubeDatabase.retrieveNaptanId(fromStationId);
    const toNaptanId = await tubeDatabase.retrieveNaptanId(toStationId);

    // Retrieves line name for given line ID 
    const lineName = await tubeDatabase.retrieveLineName(lineId);

    // Collects matching features for this segment (some segments may map to multiple GeoJSON features)
    const segmentFeatures = Array<GeoJSON.Feature>();

    // Loop through all features in GeoJSON file
    for (const feature of tubePolylines.features) {
        // If match found, adds feature to array 
        if (featureMatchesSegment(fromNaptanId, toNaptanId, lineName, feature)) {
            // Adds line color to feature properties for styling 
            const featureWithColor = {
                ...feature,
                properties: {
                    lineColor: LINE_COLOURS_MAP[lineName],
                }
            } as GeoJSON.Feature;

            segmentFeatures.push(featureWithColor);
        }
    }

    // If no matches found after checking all features, returns null to indicate missing data
    if (segmentFeatures.length === 0) {
        return null;
    }

    // Return array of all matching features for this segment
    return segmentFeatures;
}

// Function that checks whether a GeoJSON feature represents a given segment
function featureMatchesSegment(fromNaptanId: string, toNaptanId: string, lineName: string, feature: any): boolean {
    const featureDetail = feature.properties;

    // If feature is missing required properties, returns false
    if (!featureDetail) {
        return false;
    }

    // Extracts start and end Naptan IDs and line name from feature properties
    const startStationId = featureDetail.start_sid;
    const endStationId = featureDetail.end_sid;
    const featureLineName = featureDetail.name;

    // If any required properties are missing, returns false
    if (!startStationId || !endStationId || !featureLineName) {
        return false;
    }

    // Checks if feature matches segment in either direction
    const sameLine = (featureLineName === lineName);
    const direct = (startStationId === fromNaptanId && endStationId === toNaptanId);
    const reverse = (startStationId === toNaptanId && endStationId === fromNaptanId);

    // Returns true if feature matches segment in either direction and is on the correct line
    return sameLine && (direct || reverse);
}

// Function that calculates boundary coordinates for a route, used to set map view to fit entire route
export function calculateBoundaryCoordinates(routePolylines: GeoJSON.FeatureCollection): CoordinateRange {
    // Creates 2D array to store all coordinates from all features in route 
    const coordinates: number[][] = [];

    // Loops through all features in route
    for (const feature of routePolylines.features) {
        if (feature.geometry?.type === 'LineString') {
            // Extracts coordinates for this feature
            const coords = feature.geometry.coordinates as number[][];

            // Adds coordinates for this feature to overall coordinates array
            coordinates.push(...coords);
        }
    }

    // Extracts all longitudes and latitudes into separate arrays
    const longitudes = coordinates.map(coordinate => coordinate[0]);
    const latitudes = coordinates.map(coordinate => coordinate[1]);

    // Finds minimum and maximum longitude and latitude
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);

    // Returns object containing boundary coordinates
    return { minLongitude, minLatitude, maxLongitude, maxLatitude };
}
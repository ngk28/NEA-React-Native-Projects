import { coordinateRange, optimalRouteResult } from '@/components/types';
import * as GeoJSON from 'geojson';
import tubeLines from '../assets/tubeLines.json';
import { tubeDatabase } from './tubeDatabase';

// London Underground line colors
const LINE_COLORS: { [lineName: string]: string } = {
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
    'Elizabeth': '#60399E',
    'Interchange - Walking': '#5E3D3D',
};

export async function buildRouteGeoJSON(route: optimalRouteResult): Promise<GeoJSON.FeatureCollection> {
    const features: GeoJSON.Feature[] = [];
    const stations = route.optimalStationSequence;
    const lines = route.optimizedLineSequence;

    for (let i = 0; i < stations.length - 1; i++) {
        const fromStationId = stations[i];
        const toStationId = stations[i + 1];
        const lineId = lines[i];

        try {
            const featuresForSegment = await findFeatureForSegment(fromStationId, toStationId, lineId); // possibility for multiple features for a pair of stations in the JSON 
            if (featuresForSegment) {
                features.push(...featuresForSegment);
            } else {
                console.warn('No GeoJSON segment found for', { fromStationId, toStationId, lineId });
            }
        } catch (err) {
            console.error('Failed to resolve segment', { fromStationId, toStationId, lineId, err });
        }
    }
    return { type: 'FeatureCollection', features };
}

async function findFeatureForSegment(fromStationId: number, toStationId: number, lineId: number) {
    const fromNaptanId = await tubeDatabase.retrieveNaptanId(fromStationId);
    const toNaptanId = await tubeDatabase.retrieveNaptanId(toStationId);
    const lineName = await tubeDatabase.retrieveLineName(lineId);

    const features = Array<GeoJSON.Feature>();
    for (const feature of tubeLines.features) {
        if (isCorrectFeature(fromNaptanId, toNaptanId, lineName, feature)) {
            // Add line color to feature properties
            const featureWithColor = {
                ...feature,
                properties: {
                    lineColor: LINE_COLORS[lineName],
                }
            } as GeoJSON.Feature;
            features.push(featureWithColor);
        }
    }
    if (features.length === 0) {
        return null;
    }
    return features;
}

function isCorrectFeature(fromNaptanId: string, toNaptanId: string, lineName: string, feature: any) {
    const featureDetail = feature.properties;

    if (!featureDetail) return false;

    const start = featureDetail.start_sid;
    const end = featureDetail.end_sid;
    const featureLine = featureDetail.name;

    if (!start || !end || !featureLine) return false;
    const sameLine = (featureLine === lineName);
    const direct = (start === fromNaptanId && end === toNaptanId);
    const reverse = (start === toNaptanId && end === fromNaptanId);
    if (sameLine && (direct || reverse)) {
        return true;
    }
    return false;
}

export function calculateBoundaryCoordinates(route: GeoJSON.FeatureCollection): coordinateRange {
    const coordinates: number[][] = [];
    for (const feature of route.features) {
        if (feature.geometry?.type === 'LineString') {
            const coords = feature.geometry.coordinates as number[][];
            coordinates.push(...coords);
        }
    }
    const longitudes = coordinates.map(coordinate => coordinate[0]);
    const latitudes = coordinates.map(coordinate => coordinate[1]);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    return { minLongitude, minLatitude, maxLongitude, maxLatitude };
}
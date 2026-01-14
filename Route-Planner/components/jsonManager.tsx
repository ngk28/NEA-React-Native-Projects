import * as GeoJSON from 'geojson';
import tubeLines from '../assets/tubeLines.json';
import { Database } from './database';
import { pathFinderResult, } from '@/components/types';

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
    'Interchange - Walking': '#5e3d3d',
};


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

async function findFeatureForNaptanPair(fromStationId: number, toStationId: number, lineId: number) {
    const fromNaptanId = await Database.retrieveNaptanId(fromStationId);
    const toNaptanId = await Database.retrieveNaptanId(toStationId);
    const lineName = await Database.retrieveLineName(lineId);

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

export async function buildRouteFeatureCollection(route: pathFinderResult): Promise<GeoJSON.FeatureCollection> {
    const features: GeoJSON.Feature[] = [];

    for (let i = 0; i < route.optimalStationSequence.length - 1; i++) {
        const fromStationId = route.optimalStationSequence[i];
        const toStationId = route.optimalStationSequence[i + 1];
        const lineId = route.optimizedLineSequence[i];

        try {
            const featuresForPair = await findFeatureForNaptanPair(fromStationId, toStationId, lineId); // there can be multiple features for a pair of stations in the JSON 
            if (featuresForPair) {
                features.push(...featuresForPair);
            } else {
                console.warn('No GeoJSON segment found for', { fromStationId, toStationId, lineId });
            }
        } catch (err) {
            console.error('Failed to resolve segment', { fromStationId, toStationId, lineId, err });
        }
    }

    return { type: 'FeatureCollection', features };
}
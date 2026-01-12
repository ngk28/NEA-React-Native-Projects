import { useRoute } from '@/contexts/RouteContext';
import Mapbox from "@rnmapbox/maps";
import React, { useEffect, useRef, useState } from 'react';
import { buildRouteFeatureCollection } from '@/components/jsonManager';
import { Database } from '@/components/database';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

const accessToken = "pk.eyJ1Ijoiam4xMzI0IiwiYSI6ImNtZ2txMGg5bzB0c3oyanNneHk2NzhiM2YifQ.Y9SOFJzcEKXBcp5vWZ4-og";

Mapbox.setAccessToken(accessToken);
Mapbox.setTelemetryEnabled(false);

type station = {
    stationId: number;
    stationName: string;
    fromLineName?: string | null;
    toLineName?: string | null;
};

export default function MapScreen() {
    const { route } = useRoute();
    const [routeGeoJSON, setRouteGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
    const cameraRef = useRef<Mapbox.Camera>(null);

    const [stationDetails, setStationDetails] = useState<Array<station>>([]);
    const [transferStations, setTransferStations] = useState<Array<station>>([]);
    const [popupVisible, setPopupVisible] = useState(false);
    const [expanded, setExpanded] = useState(false);

    async function loadRouteGeometry() {
        try {
            const featureCollection = await buildRouteFeatureCollection(route!);
            setRouteGeoJSON(featureCollection);
            // Build popup data (station names, transfers)
            buildPopupData(route);
            setPopupVisible(true);
        } catch (err) {
            console.error('Failed to build route geometry:', err);
            setRouteGeoJSON(null);
            setPopupVisible(false);
        }
    }

    async function buildPopupData(route: any) {
        try {
            const stationNames = await Promise.all(route.stations.map((id: number) => Database.retrieveStationName(id)));
            const details = route.stations.map((stationId: number, idx: number) => ({ stationId, stationName: stationNames[idx] }));
            setStationDetails(details);

            // detect transfer stations (include start and end)
            const transfers: Array<{ stationId: number; stationName: string; fromLineName?: string | null; toLineName?: string | null }> = [];
            const lines: number[] = route.lines || [];
            for (let i = 0; i < details.length; i++) {
                // start
                if (i === 0) {
                    const toLineId = lines[0];
                    const toLineName = toLineId != null ? await Database.retrieveLineName(toLineId) : null;
                    transfers.push({ stationId: details[i].stationId, stationName: details[i].stationName, fromLineName: null, toLineName: toLineName });
                    continue;
                }
                // end
                if (i === details.length - 1) {
                    const fromLineId = lines[lines.length - 1];
                    const fromLineName = fromLineId != null ? await Database.retrieveLineName(fromLineId) : null;
                    transfers.push({ stationId: details[i].stationId, stationName: details[i].stationName, fromLineName: fromLineName, toLineName: null });
                    continue;
                }
                // intermediate - check if line changes between segments i-1 and i
                const prevLine = lines[i - 1];
                const nextLine = lines[i];
                if (prevLine !== nextLine) {
                    const fromLineName = prevLine != null ? await Database.retrieveLineName(prevLine) : null;
                    const toLineName = nextLine != null ? await Database.retrieveLineName(nextLine) : null;
                    transfers.push({ stationId: details[i].stationId, stationName: details[i].stationName, fromLineName, toLineName });
                }
            }
            setTransferStations(transfers);
        } catch (err) {
            console.error('Failed to build popup data:', err);
            setStationDetails([]);
            setTransferStations([]);
        }
    }

    // Fit camera to route bounds
    function fitCameraToRoute() {
        if (!routeGeoJSON || !cameraRef.current) {
            return;
        }
        const coordinates: number[][] = [];
        for (const feature of routeGeoJSON.features) {
            if (feature.geometry?.type === 'LineString') {
                coordinates.push(...(feature.geometry.coordinates as number[][]));
            }
        }

        const longitudes = coordinates.map(coordinate => coordinate[0]);
        const latitudes = coordinates.map(coordinate => coordinate[1]);
        const minLongitude = Math.min(...longitudes);
        const maxLongitude = Math.max(...longitudes);
        const minLatitude = Math.min(...latitudes);
        const maxLatitude = Math.max(...latitudes);
        cameraRef.current.fitBounds(
            [minLongitude, minLatitude],
            [maxLongitude, maxLatitude],
            10, // Padding
            1000 // Animation duration in ms
        );
    }

    useEffect(() => {
        if (route) {
            loadRouteGeometry();
        }
    }, [route]);

    // After geometry is loaded, adjust camera to fit the route
    useEffect(() => {
        if (routeGeoJSON) {
            fitCameraToRoute();
        }
    }, [routeGeoJSON]);



    return (
        <View style={{ flex: 1 }}>
            <Mapbox.MapView style={{ flex: 1 }} styleURL={"mapbox://styles/jn1324/cmdn5a594001501pjh1jc8d4m"}>

                {/* Map 'Camera'*/}
                <Mapbox.Camera
                    ref={cameraRef}
                    zoomLevel={12}
                    centerCoordinate={[-0.1276, 51.5074]} // Centre of London coordinates
                />

                {/* Displays route onto map */}
                {routeGeoJSON && routeGeoJSON.features.length > 0 && (
                    <>
                        {routeGeoJSON.features.map((feature, index) => (
                            <Mapbox.ShapeSource key={`route-${index}`} id={`route-${index}`} shape={feature}>
                                <Mapbox.LineLayer
                                    id={`routeLayer-${index}`}
                                    style={{
                                        lineColor: feature.properties?.lineColor || '#FFFFFF',
                                        lineWidth: 4,
                                        lineOpacity: 0.9,
                                    }}
                                />
                            </Mapbox.ShapeSource>
                        ))}
                    </>
                )}
            </Mapbox.MapView>

            {popupVisible && route && (
                <View style={styles.popupContainer}>
                    <View style={styles.popupCard}>
                        <View style={styles.popupHeader}>
                            <Text style={styles.popupRouteTitle}>Route</Text>
                            <Text style={styles.popupTime}>{Math.round(route.totalTime)} min</Text>
                        </View>

                        {stationDetails.length > 0 && (
                            <View style={styles.routeSummary}>
                                <Text style={styles.routeStartEndPoint}>{stationDetails[0].stationName} → {stationDetails[stationDetails.length - 1].stationName}</Text>
                            </View>
                        )}

                        <View style={styles.transfersList}>
                            {transferStations.map((t) => (
                                <View key={`transfer-${t.stationId}`} style={styles.transferItem}>
                                    <Text style={styles.transferName}>{t.stationName}</Text>
                                    <Text style={styles.transferLines}>{t.toLineName}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.popupActions}>
                            <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandButton}>
                                <Text style={styles.expandButtonText}>{expanded ? 'Collapse' : 'Show all stations'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setPopupVisible(false); }} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>

                        {expanded && (
                            <ScrollView style={styles.expandedList}>
                                {stationDetails.map((s, idx) => (
                                    <View key={`station-${s.stationId}-${idx}`} style={styles.expandedItem}>
                                        <Text style={styles.expandedIndex}>{idx + 1}.</Text>
                                        <Text style={styles.expandedName}>{s.stationName}</Text>
                                        <Text style={styles.expandedLine}>{route.lines && route.lines[idx] ? ` (${route.lines[idx]})` : ''}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            )}
        </View>








    );
}

const styles = StyleSheet.create({
    popupContainer: {
        position: 'absolute',
        left: 10,
        right: 10,
        bottom: 14,
        alignItems: 'center',
    },
    popupCard: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 15,
        padding: 15,
    },
    popupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    popupRouteTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    popupTime: {
        fontSize: 18,
        color: '#131212',
    },
    routeSummary: {
        marginBottom: 6,
    },
    routeStartEndPoint: {
        fontSize: 16,
    },
    transfersList: {
        marginBottom: 4,
    },
    transferItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    transferName: {
        fontSize: 14,
    },
    transferLines: {
        fontSize: 14,
        color: '#3b3b3b',
    },
    popupActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    expandButton: {
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    expandButtonText: {
        color: '#007AFF',
    },
    closeButton: {
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    closeButtonText: {
        color: '#d00',
    },
    expandedList: {
        marginTop: 8,
        maxHeight: 180,
    },
    expandedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#eee',
    },
    expandedIndex: {
        width: 24,
        color: '#666',
    },
    expandedName: {
        flex: 1,
    },
    expandedLine: {
        color: '#666',
        marginLeft: 6,
    },
});

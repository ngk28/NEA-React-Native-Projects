import { retrieveDisruptions } from '@/components/disruptionAPI';
import { buildRouteGeoJSON, calculateBoundaryCoordinates } from '@/components/jsonManager';
import { generateStationLineList, generateTransferStationList } from '@/components/pathFinder';
import { disruptionEvent, station } from '@/components/types';
import { useRoute } from '@/contexts/RouteContext';
import Mapbox from "@rnmapbox/maps";
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MAPBOX_STYLE_URL = "mapbox://styles/jn1324/cmdn5a594001501pjh1jc8d4m";
const accessToken = "pk.eyJ1Ijoiam4xMzI0IiwiYSI6ImNtZ2txMGg5bzB0c3oyanNneHk2NzhiM2YifQ.Y9SOFJzcEKXBcp5vWZ4-og";

Mapbox.setAccessToken(accessToken);
Mapbox.setTelemetryEnabled(false);

export default function MapScreen() {
    const { route } = useRoute();
    const [routeGeoJSON, setRouteGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
    const [offlineMap, setOfflineMap] = useState<any | null>(null);
    const cameraRef = useRef<Mapbox.Camera>(null);

    const [stationDetails, setStationDetails] = useState<Array<station>>([]);
    const [transferStations, setTransferStations] = useState<Array<station>>([]);
    const [selectedStation, setSelectedStation] = useState<station | null>(null);
    const [disruptions, setDisruptions] = useState<Array<disruptionEvent>>([]);
    const [popupVisible, setPopupVisible] = useState(false);
    const [expandedPopupVisible, setExpandedPopupVisible] = useState(false);
    const [disruptionToView, setDisruptionToView] = useState<disruptionEvent | null>(null);

    // Retreives route geometry (from GeoJSON) to display accurate path on map
    async function buildRouteGeometry() {
        try {
            const routeGeoJSON = await buildRouteGeoJSON(route!);
            setRouteGeoJSON(routeGeoJSON);
            setPopupVisible(true);
        } catch (err) {
            console.error('Failed to build route geometry:', err);
            setPopupVisible(false);
        }
    }

    // Retreives station details and transfer stations for popup display
    async function buildPopupData() {
        try {
            const stationDetail = await generateStationLineList();
            setStationDetails(stationDetail);
            const transferStations = await generateTransferStationList();
            setTransferStations(transferStations);
            const disruptionData = await retrieveDisruptions();
            setDisruptions(disruptionData);
        } catch (err) {
            console.error('Failed to build popup data:', err);
        }
    }

    // Fit camera to route bounds
    function fitCameraToRoute(routeGeoJSON: GeoJSON.FeatureCollection) {
        if (!cameraRef.current) {
            return;
        }
        const coordinateBounds = calculateBoundaryCoordinates(routeGeoJSON);
        cameraRef.current.fitBounds(
            [coordinateBounds.minLongitude, coordinateBounds.minLatitude],
            [coordinateBounds.maxLongitude, coordinateBounds.maxLatitude],
            10, // padding
            1000 // animation duration in ms
        );
    }

    // Download offline map for London area
    async function downloadMap() {
        try {
            const offlineMap = await Mapbox.offlineManager.createPack({
                name: "LondonDownload",
                styleURL: MAPBOX_STYLE_URL,
                minZoom: 10,
                maxZoom: 20,
                bounds: [[-0.55240631, 51.322030], [0.27980804, 51.749989]], // London bounding box
            },
                (offlinePack, status) => {
                    if (status.percentage % 10 === 0) {
                        console.log(`Map download progress: ${status.percentage}%`);
                    }
                },
                (offlinePack, error) => {
                    console.error("Error downloading map pack:", error);
                });
            return offlineMap;
        } catch (error) {
            console.error("Error downloading map:", error);
        }
    }

    function fetchLineDisruption(lineName: string): disruptionEvent | null {
        for (const disruption of disruptions) {
            if (disruption.lineName === lineName && disruption.timeDelay > 5) {
                return disruption;
            }
        }
        return null;
    }
    // Start downloading offline map on startup
    useEffect(() => {
        async () => {
            try {
                const offlineMap = await downloadMap();
                setOfflineMap(offlineMap);
                console.log("Map downloading");
            } catch (error) {
                console.error("Error downloading map:", error);
            }
        };
    }, []);

    // When route changes, rebuilds geometry and popup data
    useEffect(() => {
        if (!route) {
            setRouteGeoJSON(null);
            setPopupVisible(false);
            return;
        }
        buildRouteGeometry();
        buildPopupData();
    }, [route]);

    // After geometry is loaded, adjust camera to fit the route
    useEffect(() => {
        if (routeGeoJSON) {
            fitCameraToRoute(routeGeoJSON);
        }
    }, [routeGeoJSON]);

    return (
        <View style={{ flex: 1 }}>
            <Mapbox.MapView style={{ flex: 1 }} styleURL={MAPBOX_STYLE_URL} offlinePacks={offlineMap}>
                {/* Default camera position over London */}
                <Mapbox.Camera
                    ref={cameraRef}
                    zoomLevel={12}
                    centerCoordinate={[-0.1276, 51.5074]}
                />

                {routeGeoJSON && routeGeoJSON.features.length > 0 && (
                    <>
                        {/* Display route on map */}
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

                        {/* Display station markers onto route */}
                        {stationDetails.map((station, index) => {
                            const isStart = (index === 0);
                            const isEnd = (index === stationDetails.length - 1);
                            const isTransfer = (transferStations.some(transferStation => transferStation.id === station.id));

                            return (
                                <Mapbox.PointAnnotation
                                    key={`marker-${station.id}`}
                                    id={`marker-${station.id}`}
                                    coordinate={[station.longitude!, station.latitude!]}
                                    anchor={{ x: 0.5, y: 1.01 }}
                                    onSelected={() => setSelectedStation(station)}
                                    onDeselected={() => setSelectedStation(null)}
                                >
                                    <View>
                                        {isStart ? (
                                            <Image
                                                source={require('../../assets/blueMarker.png')}
                                                style={styles.startMarker}
                                            />
                                        ) : isEnd ? (
                                            <Image
                                                source={require('../../assets/redMarker.png')}
                                                style={styles.endMarker}
                                            />
                                        ) : isTransfer ? (
                                            <Image
                                                source={require('../../assets/greenMarker.png')}
                                                style={styles.transferMarker}
                                            />
                                        ) : (
                                            <Image
                                                source={require('../../assets/greyMarker.png')}
                                                style={styles.intermediateMarker}
                                            />
                                        )}
                                    </View>
                                </Mapbox.PointAnnotation>
                            );
                        })}
                    </>
                )}
            </Mapbox.MapView>

            {/* Popup showing station details of selected station */}
            {selectedStation && (
                <View style={styles.stationPopup}>
                    <Text style={styles.stationName}>{selectedStation.name}</Text>
                    <Text style={styles.stationDetails}>Line: {formatLineText(selectedStation.fromLineName, selectedStation.toLineName)}</Text>
                    <TouchableOpacity onPress={() => setSelectedStation(null)} style={styles.closeStationPopup}>
                        <Text style={styles.closeStationPopupText}>Close</Text>
                    </TouchableOpacity>
                </View>
            )}


            { /* Popup showing route details */}
            {popupVisible && route && (
                <View style={styles.popupContainer}>
                    <View style={styles.popupCard}>
                        <View style={styles.popupHeader}>
                            <Text style={styles.popupTitle}>Route</Text>
                            <Text style={styles.popupTime}>{Math.round(route.totalTravelTime)} min</Text>
                        </View>

                        {stationDetails.length > 0 && (
                            <View style={styles.routeSummary}>
                                <Text style={styles.routeStartEndPoint}>{stationDetails[0].name} → {stationDetails[stationDetails.length - 1].name}</Text>
                            </View>
                        )}

                        <View style={styles.transfersList}>
                            {transferStations.map((transferStation) => (
                                <View style={styles.transferItem} key={`transfer-${transferStation.id}`}>
                                    <Text style={styles.transferName}>{transferStation.name}</Text>
                                    {fetchLineDisruption(transferStation.toLineName || "") ?
                                        <TouchableOpacity style={styles.disruptedLineButton} onPress={() => {
                                            setPopupVisible(false);
                                            setDisruptionToView(fetchLineDisruption(transferStation.toLineName || "")!);
                                        }}>
                                            <Text style={styles.transferLines}>{transferStation.toLineName}</Text>
                                        </TouchableOpacity> :
                                        <Text style={styles.transferLines}>{transferStation.toLineName}</Text>
                                    }
                                </View>
                            ))}
                        </View>

                        <View style={styles.popupActionButtons}>
                            <TouchableOpacity onPress={() => setExpandedPopupVisible(!expandedPopupVisible)} style={styles.expandButton}>
                                <Text style={styles.expandButtonText}>{expandedPopupVisible ? 'Collapse' : 'Show all stations'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setPopupVisible(false); }} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>

                        {expandedPopupVisible && (
                            <ScrollView style={styles.expandedList}>
                                {stationDetails.map((station, indexNumber) => (
                                    <View key={`station-${station.id}-${indexNumber}`} style={styles.expandedItem}>
                                        <Text style={styles.expandedIndex}>{indexNumber + 1}.</Text>
                                        <Text style={styles.expandedName}>{station.name}</Text>
                                        {station.fromLineName !== station.toLineName ? (
                                            <Text style={styles.expandedLine}>{formatLineText(station.fromLineName, station.toLineName)}</Text>
                                        ) : null}
                                    </View>
                                ))}
                            </ScrollView>
                        )}

                    </View>
                </View>
            )}

            { /* Popup showing disruption details */}
            {disruptionToView && (
                <View style={styles.popupContainer}>
                    <View style={styles.popupCard}>
                        <View style={styles.popupHeader}>
                            <Text style={styles.popupTitle}>Disruption on {disruptionToView.lineName}</Text>
                        </View>
                        <View style={styles.routeSummary}>
                            <Text>Status: {disruptionToView.status}</Text>
                            <Text>Reason: {disruptionToView.reason}</Text>
                            <Text>Expected delay: {disruptionToView.timeDelay} minutes</Text>
                        </View>
                        <View style={styles.popupActionButtons}>
                            <TouchableOpacity onPress={() => { setDisruptionToView(null); setPopupVisible(true); }} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            { /* Button to re-open route popup */}
            {!popupVisible && !disruptionToView && route && (
                <TouchableOpacity onPress={() => setPopupVisible(true)} style={styles.openPopupButton}>
                    <Text style={styles.openPopupButtonText}>Show Route</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

function formatLineText(fromLineName: string | null | undefined, toLineName: string | null | undefined): string {
    if (!fromLineName) {
        return toLineName!;
    } else if (!toLineName) {
        return fromLineName!;
    } else if (fromLineName === toLineName) {
        return fromLineName!;
    } else {
        return `${fromLineName} → ${toLineName}`;
    }
}


const styles = StyleSheet.create({
    openPopupButton: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    openPopupButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    stationPopup: {
        position: 'absolute',
        top: 30,
        left: 20,
        right: 20,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 15,
        alignItems: 'center',
    },
    stationDetails: {
        fontSize: 16,
        marginBottom: 10,
    },
    disruptedLineButton: {
        backgroundColor: '#ff4d4d',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    closeStationPopup: {
        marginTop: 10,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#d00',
        borderRadius: 5,
    },
    closeStationPopupText: {
        color: '#fff',
        fontSize: 14,
    },
    stationName: {
        fontSize: 18,
        marginBottom: 8,
    },
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
    popupTitle: {
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
    popupActionButtons: {
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
    startMarker: {
        width: 45,
        height: 45,
        opacity: 0.95,
    },
    endMarker: {
        width: 40,
        height: 60,
        opacity: 0.95,
    },
    transferMarker: {
        width: 50,
        height: 50,
        opacity: 0.95,
    },
    intermediateMarker: {
        width: 30,
        height: 30,
        opacity: 0.95,
    },
});

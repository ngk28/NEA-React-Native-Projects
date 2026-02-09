import { calculateBoundaryCoordinates, generateRoutePolyline } from '@/components/jsonManager';
import { retrieveCachedRouteStations, retrieveTransferStations } from '@/components/routeFinder';
import { fetchTubeStatusService } from '@/components/serviceStatus';
import { ThemedView } from '@/components/themed-view';
import { LineStatus, Station } from '@/components/types';
import { useRoute } from '@/contexts/RouteContext';
import Mapbox from "@rnmapbox/maps";
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Mapbox configuration with API key and style URL for map display 
const MAPBOX_STYLE_URL = "mapbox://styles/jn1324/cmdn5a594001501pjh1jc8d4m";
const accessToken = "pk.eyJ1Ijoiam4xMzI0IiwiYSI6ImNtZ2txMGg5bzB0c3oyanNneHk2NzhiM2YifQ.Y9SOFJzcEKXBcp5vWZ4-og";
Mapbox.setAccessToken(accessToken);
Mapbox.setTelemetryEnabled(false);

export default function MapScreen() {
    // Route context allows optimal route to be shared across pages
    const { route } = useRoute();

    // Stores offline map pack
    const [offlineMap, setOfflineMap] = useState<any | null>(null);

    // Controls movement and zoom of map
    const cameraRef = useRef<Mapbox.Camera>(null);

    // Stores GeoJSON data for exact route to be displayed on map
    const [routeGeometry, setRouteGeometry] = useState<GeoJSON.FeatureCollection | null>(null);

    // Stores optimal route details like station details, transfer stations and status to generate popups 
    const [stationDetails, setStationDetails] = useState<Array<Station>>([]);
    const [transferStations, setTransferStations] = useState<Array<Station>>([]);
    const [tubeStatus, setTubeStatus] = useState<Array<LineStatus>>([]);

    // Controls display of popups for station details, route details and status details
    const [highlightedStation, setHighlightedStation] = useState<Station | null>(null);
    const [popupVisible, setPopupVisible] = useState(false);
    const [expandedPopupVisible, setExpandedPopupVisible] = useState(false);
    const [selectedLineStatus, setSelectedLineStatus] = useState<LineStatus | null>(null);

    // Retreives route geometry (from GeoJSON) to display accurate path on map
    async function buildRouteGeometry() {
        try {
            const routeGeometry = await generateRoutePolyline(route!);
            setRouteGeometry(routeGeometry);
            setPopupVisible(true);
        } catch (err) {
            console.error('Failed to build route geometry:', err);
            setPopupVisible(false);
        }
    }

    // Retreives data for popup display
    async function buildPopupData() {
        try {
            const stationDetails = await retrieveCachedRouteStations();
            setStationDetails(stationDetails);
            const transferStations = await retrieveTransferStations();
            setTransferStations(transferStations);
            const tubeStatusData = await fetchTubeStatusService();
            setTubeStatus(tubeStatusData);
        } catch (err) {
            console.error('Failed to build popup data:', err);
        }
    }

    // Fits camera to route bounds
    function fitCameraToRoute(routeGeometry: GeoJSON.FeatureCollection) {
        if (!cameraRef.current) {
            return;
        }
        const coordinateBounds = calculateBoundaryCoordinates(routeGeometry);
        cameraRef.current.fitBounds(
            [coordinateBounds.minLongitude, coordinateBounds.minLatitude],
            [coordinateBounds.maxLongitude, coordinateBounds.maxLatitude],
            10, // padding
            1000 // animation duration in ms
        );
    }

    // Downloads offline map for London area
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

    // Retrieves line status for a given line name 
    // Only returns status if there is a disruption causing delay, otherwise returns null to indicate no disruption
    function fetchLineStatus(lineName: string): LineStatus | null {
        for (const lineStatus of tubeStatus) {
            if (lineStatus.lineName === lineName && lineStatus.delayMinutes > 0) {
                return lineStatus;
            }
        }
        return null;
    }

    // Starts downloading offline map on startup
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

    // Rebuilds train path and popup data when new route is searched
    useEffect(() => {
        // If no route found, resets map and hides popups
        if (!route) {
            setRouteGeometry(null);
            setPopupVisible(false);
            return;
        }

        // If route found, builds route geometry and popup data
        buildRouteGeometry();
        buildPopupData();
    }, [route]);

    // Adjusts camera to fit the route once train path is drawn
    useEffect(() => {
        if (routeGeometry) {
            fitCameraToRoute(routeGeometry);
        }
    }, [routeGeometry]);

    return (
        <View style={{ flex: 1 }}>
            {/* Renders map using offline pack if available */}
            <Mapbox.MapView style={{ flex: 1 }} styleURL={MAPBOX_STYLE_URL} offlinePacks={offlineMap}>
                {/* Default camera position over London */}
                <Mapbox.Camera
                    ref={cameraRef}
                    zoomLevel={12}
                    centerCoordinate={[-0.1276, 51.5074]}
                />

                {/* Renders route only if a path exists */}
                {routeGeometry && routeGeometry.features.length > 0 && (
                    <>
                        {/* Displays exact route onto map as polylines */}
                        {routeGeometry.features.map((feature, index) => (
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

                        {/* Displays station markers onto stations on route */}
                        {stationDetails.map((station, index) => {
                            {/* Identifies type of station (eg start, end, transfer, intermediate) */ }
                            const isStart = (index === 0);
                            const isEnd = (index === stationDetails.length - 1);
                            const isTransfer = (transferStations.some(transferStation => transferStation.id === station.id));

                            return (
                                <Mapbox.PointAnnotation
                                    key={`marker-${station.id}`}
                                    id={`marker-${station.id}`}
                                    coordinate={[station.longitude!, station.latitude!]}
                                    anchor={{ x: 0.5, y: 1.01 }}
                                    onSelected={() => setHighlightedStation(station)}
                                    onDeselected={() => setHighlightedStation(null)}
                                >
                                    {/* Renders different coloured markers based on station type */}
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

            {/* Popup showing station details of a highlighted station */}
            {highlightedStation && (
                <View style={styles.stationPopup}>
                    <Text style={styles.stationName}>{highlightedStation.name}</Text>
                    <Text style={styles.stationDetail}>Line: {formatLineText(highlightedStation.fromLineName, highlightedStation.toLineName)}</Text>
                    <TouchableOpacity onPress={() => setHighlightedStation(null)} style={styles.closeStationPopupButton}>
                        <Text style={styles.closeStationPopupText}>Close</Text>
                    </TouchableOpacity>
                </View>
            )}

            { /* Popup showing route details */}
            {popupVisible && route && (
                <View style={styles.routePopupContainer}>
                    <View style={styles.routePopupCard}>
                        {/* Shows travel time and route searched */}
                        <View style={styles.routePopupHeader}>
                            <Text style={styles.popupTitle}>Route</Text>
                            <Text style={styles.popupTime}>{Math.round(route.totalTravelTime)} min</Text>
                        </View>
                        {stationDetails.length > 0 && (
                            <View style={styles.routeSummary}>
                                <Text style={styles.routeStartEndPoint}>{stationDetails[0].name} → {stationDetails[stationDetails.length - 1].name}</Text>
                            </View>
                        )}

                        {/* Shows route summary: Interchange stations and their lines */}
                        <View style={styles.transfersList}>
                            {transferStations.map((transferStation) => (
                                <View style={styles.transferItem} key={`transfer-${transferStation.id}`}>
                                    <Text style={styles.transferName}>{transferStation.name}</Text>
                                    {/* If there is a disruption on the line, shows a button to view disruption details */}
                                    {fetchLineStatus(transferStation.toLineName || "") ?
                                        <TouchableOpacity style={styles.disruptedLineButton} onPress={() => {
                                            setPopupVisible(false);
                                            setSelectedLineStatus(fetchLineStatus(transferStation.toLineName || "")!);
                                        }}>
                                            <Text style={styles.transferLines}>{transferStation.toLineName}</Text>
                                        </TouchableOpacity> :
                                        <Text style={styles.transferLines}>{transferStation.toLineName}</Text>
                                    }
                                </View>
                            ))}
                        </View>

                        {/* Button to expand popup and view all stations in route */}
                        <View style={styles.routePopupActionButtons}>
                            <TouchableOpacity onPress={() => setExpandedPopupVisible(!expandedPopupVisible)} style={styles.expandButton}>
                                <Text style={styles.expandButtonText}>{expandedPopupVisible ? 'Collapse' : 'Show all stations'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => {
                                setPopupVisible(false);
                                setExpandedPopupVisible(false);
                            }} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Shows all stations in route once popup expanded */}
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
            {selectedLineStatus && (
                <View style={styles.routePopupContainer}>
                    <View style={styles.routePopupCard}>
                        <View style={styles.routePopupHeader}>
                            <Text style={styles.popupTitle}>Disruption on {selectedLineStatus.lineName}</Text>
                        </View>
                        <View style={styles.routeSummary}>
                            <Text>Status: {selectedLineStatus.status}</Text>
                            <Text>Reason: {selectedLineStatus.reason}</Text>
                            <Text>Expected delay: {selectedLineStatus.delayMinutes} minutes</Text>
                        </View>
                        <View style={styles.routePopupActionButtons}>
                            <TouchableOpacity onPress={() => { setSelectedLineStatus(null); setPopupVisible(true); }} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            { /* Button to re-open route popup */}
            {!popupVisible && !selectedLineStatus && route && (
                <TouchableOpacity onPress={() => setPopupVisible(true)} style={styles.openPopupButton}>
                    <Text style={styles.openPopupButtonText}>Show Route</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

// Function that formats line text for display on popups, accounts for different scenarios of line changes 
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
    stationDetail: {
        fontSize: 16,
        marginBottom: 10,
    },
    disruptedLineButton: {
        backgroundColor: '#ff4d4d',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    closeStationPopupButton: {
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
    routePopupContainer: {
        position: 'absolute',
        left: 10,
        right: 10,
        bottom: 14,
        alignItems: 'center',
    },
    routePopupCard: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 15,
        padding: 15,
    },
    routePopupHeader: {
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
    routePopupActionButtons: {
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

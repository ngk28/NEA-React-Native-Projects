import { buildRouteFeatureCollection } from '@/components/jsonManager';
import { generateStationLineList, generateTransferStationList, station } from '@/components/pathFinder';
import { useRoute } from '@/contexts/RouteContext';
import Mapbox from "@rnmapbox/maps";
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


const accessToken = "pk.eyJ1Ijoiam4xMzI0IiwiYSI6ImNtZ2txMGg5bzB0c3oyanNneHk2NzhiM2YifQ.Y9SOFJzcEKXBcp5vWZ4-og";

Mapbox.setAccessToken(accessToken);
Mapbox.setTelemetryEnabled(false);

export default function MapScreen() {
    const { route } = useRoute();
    const [routeGeoJSON, setRouteGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
    const cameraRef = useRef<Mapbox.Camera>(null);

    const [stationDetails, setStationDetails] = useState<Array<station>>([]);
    const [transferStations, setTransferStations] = useState<Array<station>>([]);
    const [selectedStation, setSelectedStation] = useState<station | null>(null);
    const [popupVisible, setPopupVisible] = useState(false);
    const [expanded, setExpanded] = useState(false);

    async function loadRouteGeometry() {
        try {
            const featureCollection = await buildRouteFeatureCollection(route!);
            setRouteGeoJSON(featureCollection);
            setPopupVisible(true);
        } catch (err) {
            console.error('Failed to build route geometry:', err);
            setPopupVisible(false);
        }
    }

    async function buildPopupData() {
        try {
            const stationDetail = await generateStationLineList();
            setStationDetails(stationDetail);
            const transferStations = await generateTransferStationList();
            setTransferStations(transferStations);
        } catch (err) {
            console.error('Failed to build popup data:', err);
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
        if (!route) {
            setRouteGeoJSON(null);
            setPopupVisible(false);
            return;
        }
        loadRouteGeometry();
        buildPopupData();
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


                {routeGeoJSON && routeGeoJSON.features.length > 0 && (
                    <>
                        {/* Displays route onto map */}
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

                        {/* Station markers */}
                        {stationDetails.map((station, index) => {
                            const isStart = (index === 0);
                            const isEnd = (index === stationDetails.length - 1);
                            const isTransfer = (transferStations.some(transferStation => transferStation.Id === station.Id));

                            return (
                                <Mapbox.PointAnnotation
                                    key={`marker-${station.Id}`}
                                    id={`marker-${station.Id}`}
                                    coordinate={[station.latitude!, station.longitude!]} // Mapbox expects [latitude, longitude] 
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

            {selectedStation && (
                <View style={styles.stationPopup}>
                    <Text style={styles.stationName}>{selectedStation.Name}</Text>
                    <Text style={styles.stationDetails}>Line: {
                        (selectedStation.fromLineName === null) ? (`${selectedStation.toLineName}`) :
                            (selectedStation.toLineName === null) ? (`${selectedStation.fromLineName}`) :
                                (selectedStation.fromLineName === selectedStation.toLineName) ? (`${selectedStation.fromLineName}`) :
                                    `${selectedStation.fromLineName} → ${selectedStation.toLineName}`}</Text>
                    <TouchableOpacity onPress={() => setSelectedStation(null)} style={styles.closeStationPopup}>
                        <Text style={styles.closeStationPopupText}>Close</Text>
                    </TouchableOpacity>
                </View>
            )}

            {popupVisible && route && (
                <View style={styles.popupContainer}>
                    <View style={styles.popupCard}>
                        <View style={styles.popupHeader}>
                            <Text style={styles.popupRouteTitle}>Route</Text>
                            <Text style={styles.popupTime}>{Math.round(route.totalTime)} min</Text>
                        </View>

                        {stationDetails.length > 0 && (
                            <View style={styles.routeSummary}>
                                <Text style={styles.routeStartEndPoint}>{stationDetails[0].Name} → {stationDetails[stationDetails.length - 1].Name}</Text>
                            </View>
                        )}

                        <View style={styles.transfersList}>
                            {transferStations.map((transferStation) => (
                                <View style={styles.transferItem} key={`transfer-${transferStation.Id}`}>
                                    <Text style={styles.transferName}>{transferStation.Name}</Text>
                                    <Text style={styles.transferLines}>{transferStation.toLineName}</Text>
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
                                {stationDetails.map((station, indexNumber) => (
                                    <View key={`station-${station.Id}-${indexNumber}`} style={styles.expandedItem}>
                                        <Text style={styles.expandedIndex}>{indexNumber + 1}.</Text>
                                        <Text style={styles.expandedName}>{station.Name}</Text>
                                        <Text style={styles.expandedLine}>{station.fromLineName === null ? `${station.toLineName}` : ''}</Text>
                                        <Text style={styles.expandedLine}>{(station.fromLineName !== station.toLineName) && (station.fromLineName !== null) && (station.toLineName !== null) ? `${station.fromLineName} → ${station.toLineName}` : ''}</Text>
                                        <Text style={styles.expandedLine}>{station.toLineName === null ? `${station.fromLineName}` : ''}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        )}

                        {/* expanded show disruption if necessary */}




                    </View>
                </View>
            )}

            {!popupVisible && route && (
                <TouchableOpacity onPress={() => setPopupVisible(true)} style={styles.openPopupButton}>
                    <Text style={styles.openPopupButtonText}>Show Route</Text>
                </TouchableOpacity>
            )}
        </View>
    );
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

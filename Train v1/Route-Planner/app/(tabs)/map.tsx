import Mapbox from "@rnmapbox/maps";
import React from 'react';

const accessToken = "pk.eyJ1Ijoiam4xMzI0IiwiYSI6ImNtZ2txMGg5bzB0c3oyanNneHk2NzhiM2YifQ.Y9SOFJzcEKXBcp5vWZ4-og";

Mapbox.setAccessToken(accessToken);
Mapbox.setTelemetryEnabled(false);

export default function MapScreen() {
    return (
        <Mapbox.MapView style={{ flex: 1 }} styleURL={"mapbox://styles/jn1324/cmdn5a594001501pjh1jc8d4m"}>


            <Mapbox.Camera
                zoomLevel={12}
                centerCoordinate={[-0.1276, 51.5074]}
            />
        </Mapbox.MapView>
    );
}
import Mapbox, { MapView } from '@rnmapbox/maps';
import React from 'react';

const accessToken = 'pk.eyJ1Ijoiam4xMzI0IiwiYSI6ImNtZ2txZHpreTB4NGoyanF3bG5nNGZicnEifQ.J85UaKh9pSelsmm-i51hrw';
Mapbox.setAccessToken(accessToken);
Mapbox.setConnected(true);

export default function Map() {
    return (
        <MapView style={{ flex: 1 }} />
    );
}

// import Mapbox, { MapView } from '@rnmapbox/maps';
// import React from 'react';

// const accessToken = 'pk.eyJ1Ijoiam4xMzI0IiwiYSI6ImNsMTVwcDgxMDE2bGgzanB3MzRuaTZtYmEifQ.WNneypuqlNoUOKRNXhFJlw';
// Mapbox.setAccessToken(accessToken);
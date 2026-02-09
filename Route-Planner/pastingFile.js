const features = Array < GeoJSON.Feature > ();
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
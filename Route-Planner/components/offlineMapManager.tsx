import Mapbox from "@rnmapbox/maps";
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE_URL } from "./secrets";

const OFFLINE_MAP_KEY = "LondonDownloadv1";

// Returns existing offline map if it exists, otherwise initiates download of map
export async function fetchOfflineMap() {
    Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
    const mapExists = await checkOfflineMapExists();
    if (mapExists) {
        const existingMap = await Mapbox.offlineManager.getPack(OFFLINE_MAP_KEY);
        return existingMap;
    }
    return await downloadMap();
}

// Downloads offline map for London area
async function downloadMap() {
    try {
        Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
        const offlineMap = await Mapbox.offlineManager.createPack({
            name: OFFLINE_MAP_KEY,
            styleURL: MAPBOX_STYLE_URL,
            minZoom: 10,
            maxZoom: 20,
            bounds: [[-0.55240631, 51.322030], [0.27980804, 51.749989]], // London bounding box
        },
            (offlineMap, status) => {
                if (status.percentage % 5 === 0) {
                    console.log(`Map download progress: ${status.percentage}%`);
                }
                // console.log(status);
            },
            (offlineMap, error) => {
                console.error("Error downloading map:", error);
            });
        return offlineMap;
    } catch (error) {
        console.error("Error downloading map:", error);
    }
}

// Checks if offline map already exists
async function checkOfflineMapExists(): Promise<Boolean> {
    try {
        Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
        const existingMaps = await Mapbox.offlineManager.getPacks();
        if (existingMaps.find(map => map.name === OFFLINE_MAP_KEY)) {
            console.log("Existing offline map found.");
            return true;
        } else {
            console.log("No existing offline map found.");
            return false;
        }
    } catch (error) {
        console.error("Error checking for offline map:", error);
        return false;
    }
}

// Clears all existing offline map packs
export async function clearOfflineMap() {
    try {
        Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
        await Mapbox.offlineManager.deletePack(OFFLINE_MAP_KEY);
        await Mapbox.offlineManager.resetDatabase();
        console.log("Offline map cleared.");
    } catch (error) {
        console.error("Error clearing offline map:", error);
    }
}
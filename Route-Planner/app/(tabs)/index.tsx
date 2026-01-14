import { Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Database } from '@/components/database';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { retrieveOptimalRoute } from '@/components/pathFinder';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRoute } from '@/contexts/RouteContext';
import * as React from 'react';
import { ScrollView } from 'react-native';
import { retrieveDisruptions } from '@/components/disruptionAPI';
import { logSearchHistory } from '@/components/searchHistoryManager';
import { station } from '@/components/types';
import { useRouter } from 'expo-router';

export default function Search() {
  const { setRoute, path: selectedPath, setPath } = useRoute();
  const router = useRouter();
  // Process
  const [startQuery, setStartQuery] = React.useState('');
  const [destQuery, setDestQuery] = React.useState('');
  // Search results given a text input - station not confirmed by user yet
  const [startMatches, setStartMatches] = React.useState<Array<station>>([]);
  const [destMatches, setDestMatches] = React.useState<Array<station>>([]);
  // Confirmed station selection by user
  const [selectedStart, setSelectedStart] = React.useState<station | null>(null);
  const [selectedDestination, setSelectedDest] = React.useState<station | null>(null);
  // React Native loading states
  const [loadingStart, setLoadingStart] = React.useState(false);
  const [loadingDest, setLoadingDest] = React.useState(false);

  // Fetch disruptions on component load to allow caching and calculation in pathfinding
  React.useEffect(() => {
    retrieveDisruptions()
      .catch((error) => console.error('Error fetching disruptions on load:', error));
  }, []);

  // Apply selections set from other tabs (e.g. Recent). Populate local inputs
  React.useEffect(() => {
    if (!selectedPath) {
      return;
    }
    const startStationFromHistory = {
      stationId: selectedPath.fromStationId,
      stationName: selectedPath.fromStationName!,
    }
    const endStationFromHistory = {
      stationId: selectedPath.toStationId,
      stationName: selectedPath.toStationName!,
    }
    onStartStationSelect(startStationFromHistory);
    onDestStationSelect(endStationFromHistory);
    // clear shared selection so only applies transfer once
    if (startStationFromHistory || endStationFromHistory) {
      setPath(null);
    }
  }, [selectedPath]);



  React.useEffect(() => {
    if (startQuery.trim().length < 2) { // Too short to search
      setStartMatches([]); // Clears any previous matches 
      return;
    }
    setLoadingStart(true); // React Native set loading state (program knows we're searching)
    Database.retrieveStationsByName(startQuery)
      .then(setStartMatches)
      .catch((err) => console.error('Start search failed:', err))
      .finally(() => setLoadingStart(false));
  }, [startQuery]);

  React.useEffect(() => {
    if (destQuery.trim().length < 2) { // Too short to search
      setDestMatches([]); // Clears any previous matches
      return;
    }
    setLoadingDest(true);
    Database.retrieveStationsByName(destQuery)
      .then(setDestMatches)
      .catch((err) => console.error('Destination search failed:', err))
      .finally(() => setLoadingDest(false));
  }, [destQuery]);


  const onStartStationSelect = (startStation: station) => {
    setSelectedStart(startStation);
    setStartQuery(startStation.stationName);
    setStartMatches([]);
  };

  const onDestStationSelect = (destinationStation: station) => {
    setSelectedDest(destinationStation);
    setDestQuery(destinationStation.stationName);
    setDestMatches([]);
  };

  const handleFindPath = async () => {
    if (!selectedStart || !selectedDestination) {
      console.warn('Pick both stations before searching.');
      return;
    }

    console.log('Finding path from', selectedStart.stationName, 'to', selectedDestination.stationName);
    try {
      const optimalRoute = await retrieveOptimalRoute(selectedStart.stationId, selectedDestination.stationId);
      const cached = optimalRoute;
      setRoute(cached);
      await logSearchHistory(selectedStart.stationId, selectedDestination.stationId);
      console.log('Optimal route found:', cached);
      router.push('/(tabs)/map');
    } catch (error) {
      console.error('Failed to retrieve shortest path:', error);
    }
  };



  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }>

      <ThemedText>Choose stations to plan a route.</ThemedText>

      <View style={styles.fieldGroup}>
        <TextInput
          style={styles.input}
          onChangeText={(text) => {
            setStartQuery(text);
            setSelectedStart(null);
          }}
          value={startQuery}
          placeholder='Starting station'
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loadingStart && <Text style={styles.helper}>Searching…</Text>}
        {!loadingStart && selectedStart && <Text style={styles.helper}>Selected: {selectedStart.stationName}</Text>}
        {selectedStart === null && (
          <ScrollView style={styles.suggestions}>
            {startMatches.length > 0 ? (
              startMatches.map((station) => (
                <TouchableOpacity style={styles.listItem} key={String(station.stationId)} onPress={() => onStartStationSelect(station)}>
                  <Text>{station.stationName}</Text>
                </TouchableOpacity>
              ))
            ) : (
              startQuery.trim().length >= 2 && !loadingStart ? <Text style={styles.helper}>No matches</Text> : null
            )}
          </ScrollView>
        )}
      </View>

      <View style={styles.fieldGroup}>
        <TextInput
          style={styles.input}
          onChangeText={(text) => {
            setDestQuery(text);
            setSelectedDest(null);
          }}
          value={destQuery}
          placeholder='Destination station'
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loadingDest && <Text style={styles.helper}>Searching…</Text>}
        {!loadingDest && selectedDestination && <Text style={styles.helper}>Selected: {selectedDestination.stationName}</Text>}
        {selectedDestination === null && (
          <ScrollView style={styles.suggestions}>
            {destMatches.length > 0 ? (
              destMatches.map((item) => (
                <TouchableOpacity key={String(item.stationId)} style={styles.listItem} onPress={() => onDestStationSelect(item)}>
                  <Text>{item.stationName}</Text>
                </TouchableOpacity>
              ))
            ) : (
              destQuery.trim().length >= 2 && selectedDestination === null && !loadingDest ? <Text style={styles.helper}>No matches</Text> : null
            )}
          </ScrollView>
        )}
      </View>

      <Button
        title="Find Path"
        onPress={handleFindPath}
      />
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldGroup: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  listItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  suggestions: {
    maxHeight: 160,
  },
  helper: {
    color: '#666',
  },
});

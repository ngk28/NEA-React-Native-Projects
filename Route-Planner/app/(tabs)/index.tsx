import { Button, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Database } from '@/components/database';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { getCachedPath, retrievePathByStationId } from '@/components/pathFinder';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as React from 'react';

export default function TabTwoScreen() {
  // Process
  const [startQuery, setStartQuery] = React.useState('');
  const [destQuery, setDestQuery] = React.useState('');
  // Search results given a text input - station not confirmed by user yet
  const [startMatches, setStartMatches] = React.useState<Array<{ stationId: number; stationName: string }>>([]);
  const [destMatches, setDestMatches] = React.useState<Array<{ stationId: number; stationName: string }>>([]);
  // Confirmed station selection by user
  const [selectedStart, setSelectedStart] = React.useState<{ stationId: number; stationName: string } | null>(null);
  const [selectedDest, setSelectedDest] = React.useState<{ stationId: number; stationName: string } | null>(null);
  // React Native loading states
  const [loadingStart, setLoadingStart] = React.useState(false);
  const [loadingDest, setLoadingDest] = React.useState(false);

  const [shortestPath, setShortestPath] = React.useState<Array<number>>([]);
  const [shortestTime, setShortestTime] = React.useState<number>(0);

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


  const handleSelectStart = (station: { stationId: number; stationName: string }) => {
    setSelectedStart(station);
    setStartQuery(station.stationName);
    setStartMatches([]);
  };

  const handleSelectDest = (station: { stationId: number; stationName: string }) => {
    setSelectedDest(station);
    setDestQuery(station.stationName);
    setDestMatches([]);
  };

  const handleFindPath = async () => {
    if (!selectedStart || !selectedDest) {
      console.warn('Pick both stations before searching.');
      return;
    }

    console.log('Finding path from', selectedStart.stationName, 'to', selectedDest.stationName);
    try {
      const path = await retrievePathByStationId(selectedStart.stationId, selectedDest.stationId);
      console.log('Shortest path found:', path);
      setShortestPath(path);
      // Get cached result instead of recalculating
      const cached = getCachedPath();
      if (cached) {
        setShortestTime(cached.totalTime);
      }
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
        />

        {loadingStart && <Text style={styles.helper}>Searching…</Text>}
        {!loadingStart && selectedStart && <Text style={styles.helper}>Selected: {selectedStart.stationName}</Text>}

        {selectedStart === null && (
          <FlatList
            data={startMatches}
            keyExtractor={(item) => String(item.stationId)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.listItem} onPress={() => handleSelectStart(item)}>
                <Text>{item.stationName}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={startQuery.trim().length >= 2 && !loadingStart ? <Text style={styles.helper}>No matches</Text> : null}
          />
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
        />

        {loadingDest && <Text style={styles.helper}>Searching…</Text>}
        {!loadingDest && selectedDest && <Text style={styles.helper}>Selected: {selectedDest.stationName}</Text>}

        {selectedDest === null && (
          <FlatList
            data={destMatches}
            keyExtractor={(item) => String(item.stationId)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.listItem} onPress={() => handleSelectDest(item)}>
                <Text>{item.stationName}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={destQuery.trim().length >= 2 && selectedDest === null && !loadingDest ? <Text style={styles.helper}>No matches</Text> : null}
          />
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
  helper: {
    color: '#666',
  },
});

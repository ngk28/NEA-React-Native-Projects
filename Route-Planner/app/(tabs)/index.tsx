import { retrieveDisruptions } from '@/components/disruptionAPI';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { retrieveOptimalRoute } from '@/components/pathFinder';
import { logSearchHistory } from '@/components/searchHistoryManager';
import { ThemedText } from '@/components/themed-text';
import { tubeDatabase } from '@/components/tubeDatabase';
import { station } from '@/components/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRoute } from '@/contexts/RouteContext';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SearchScreen() {
  const { setRoute, path: selectedPath, setPath } = useRoute();
  const router = useRouter();
  // User text input to search for stations 
  const [startQuery, setStartQuery] = React.useState('');
  const [destinationQuery, setDestinationQuery] = React.useState('');
  // Station search results for a given text input - station not yet confirmed by user
  const [startSuggestions, setStartSuggestions] = React.useState<Array<station>>([]);
  const [destinationSuggestions, setDestinationSuggestions] = React.useState<Array<station>>([]);
  // Confirmed station selection by user
  const [selectedStart, setSelectedStart] = React.useState<station | null>(null);
  const [selectedDestination, setSelectedDestination] = React.useState<station | null>(null);
  // React Native loading states
  const [loadingStart, setLoadingStart] = React.useState(false);
  const [loadingDestination, setLoadingDestination] = React.useState(false);

  // Fetch disruptions on program load to allow caching and calculation in pathfinding
  React.useEffect(() => {
    retrieveDisruptions()
      .catch((error) => console.error('Error fetching disruptions on load:', error));
  }, []);

  // Apply station selections set from recent history
  React.useEffect(() => {
    if (!selectedPath) {
      return;
    }
    const startStationFromHistory = {
      id: selectedPath.fromStationId,
      name: selectedPath.fromStationName!,
    }
    const endStationFromHistory = {
      id: selectedPath.toStationId,
      name: selectedPath.toStationName!,
    }
    handleStartStationSelection(startStationFromHistory);
    handleDestinationStationSelection(endStationFromHistory);
    setPath(null); // clear shared selection so only applies transfer once
  }, [selectedPath]);

  // Search for starting station suggestions when user types
  React.useEffect(() => {
    if (startQuery.trim().length < 2) { // Too short to search for stations
      setStartSuggestions([]); // Clears any previous suggestions 
      return;
    }
    setLoadingStart(true);
    tubeDatabase.retrieveStationSuggestions(startQuery)
      .then(setStartSuggestions)
      .catch((error) => console.error('Start suggestion failed:', error))
      .finally(() => setLoadingStart(false));
  }, [startQuery]);

  // Search for destination station suggestions when user types
  React.useEffect(() => {
    if (destinationQuery.trim().length < 2) {
      setDestinationSuggestions([]);
      return;
    }
    setLoadingDestination(true);
    tubeDatabase.retrieveStationSuggestions(destinationQuery)
      .then(setDestinationSuggestions)
      .catch((error) => console.error('Destination suggestion failed:', error))
      .finally(() => setLoadingDestination(false));
  }, [destinationQuery]);


  const handleStartStationSelection = (startStation: station) => {
    setSelectedStart(startStation);
    setStartQuery(startStation.name);
    setStartSuggestions([]);
  };

  const handleDestinationStationSelection = (destinationStation: station) => {
    setSelectedDestination(destinationStation);
    setDestinationQuery(destinationStation.name);
    setDestinationSuggestions([]);
  };

  const handleFindPath = async () => {
    if (!selectedStart || !selectedDestination) {
      console.warn('Pick both stations before searching.');
      return;
    }

    console.log('Finding path from', selectedStart.name, 'to', selectedDestination.name);
    try {
      const optimalRoute = await retrieveOptimalRoute(selectedStart.id, selectedDestination.id);
      const cached = optimalRoute;
      setRoute(cached);
      await logSearchHistory(selectedStart.id, selectedDestination.id);
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

      {/* Starting station input and suggestions */}
      <View style={styles.inputFieldContainer}>
        <TextInput
          style={styles.searchInput}
          onChangeText={(userInput) => {
            setStartQuery(userInput);
            setSelectedStart(null);
          }}
          value={startQuery}
          placeholder='Starting station'
          autoCorrect={false}
          autoCapitalize="none"
        />

        {loadingStart && <Text style={styles.feedbackText}>Searching…</Text>}
        {!loadingStart && selectedStart && <Text style={styles.feedbackText}>Selected: {selectedStart.name}</Text>}
        {selectedStart === null && (
          <ScrollView style={styles.stationSuggestions}>
            {startSuggestions.length > 0 ? (
              startSuggestions.map((station) => (
                <TouchableOpacity style={styles.stationItem} key={String(station.id)} onPress={() => handleStartStationSelection(station)}>
                  <Text>{station.name}</Text>
                </TouchableOpacity>
              ))
            ) : (
              (startQuery.trim().length >= 2 && !loadingStart) ? <Text style={styles.feedbackText}>No matches</Text> : null
            )}
          </ScrollView>
        )}
      </View>

      {/* Destination station input and suggestions */}
      <View style={styles.inputFieldContainer}>
        <TextInput
          style={styles.searchInput}
          onChangeText={(userInput) => {
            setDestinationQuery(userInput);
            setSelectedDestination(null);
          }}
          value={destinationQuery}
          placeholder='Destination station'
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loadingDestination && <Text style={styles.feedbackText}>Searching…</Text>}
        {!loadingDestination && selectedDestination && <Text style={styles.feedbackText}>Selected: {selectedDestination.name}</Text>}
        {selectedDestination === null && (
          <ScrollView style={styles.stationSuggestions}>
            {destinationSuggestions.length > 0 ? (
              destinationSuggestions.map((station) => (
                <TouchableOpacity style={styles.stationItem} key={String(station.id)} onPress={() => handleDestinationStationSelection(station)}>
                  <Text>{station.name}</Text>
                </TouchableOpacity>
              ))
            ) : (
              (destinationQuery.trim().length >= 2 && !loadingDestination) ? <Text style={styles.feedbackText}>No matches</Text> : null
            )}
          </ScrollView>
        )}
      </View>

      {/* Search button */}
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
  inputFieldContainer: {
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  stationItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  stationSuggestions: {
    maxHeight: 160,
  },
  feedbackText: {
    color: '#666',
  },
});

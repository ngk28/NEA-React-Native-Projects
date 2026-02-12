import ParallaxScrollView from '@/components/parallax-scroll-view';
import { retrieveOptimalRoute } from '@/components/routeFinder';
import { logSearch } from '@/components/searchHistory';
import { fetchTubeStatusService } from '@/components/serviceStatus';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { tubeDatabase } from '@/components/tubeDatabase';
import { Station } from '@/components/types';
import { useRoute } from '@/contexts/RouteContext';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Button, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SearchScreen() {
  // Router allows automatic navigation to another page 
  const router = useRouter();

  // Route context allows optimal route and selected route to be shared across pages without having to access cache or recalculate
  const { setRouteResult, selectedPath, setSelectedPath } = useRoute();

  // Handles user's text inputs when searching for stations 
  const [startQuery, setStartQuery] = React.useState('');
  const [destinationQuery, setDestinationQuery] = React.useState('');

  // Displays search results for a given text input - station not yet confirmed by user
  const [startSuggestions, setStartSuggestions] = React.useState<Array<Station>>([]);
  const [destinationSuggestions, setDestinationSuggestions] = React.useState<Array<Station>>([]);

  // Stores station selected by user
  const [selectedStart, setSelectedStart] = React.useState<Station | null>(null);
  const [selectedDestination, setSelectedDestination] = React.useState<Station | null>(null);

  // Handles React Native loading states
  const [loadingStart, setLoadingStart] = React.useState(false);
  const [loadingDestination, setLoadingDestination] = React.useState(false);

  // Fetches Tube status on program load to allow caching and calculation in pathfinding
  React.useEffect(() => {
    fetchTubeStatusService()
      .catch((error) => console.error('Error fetching Tube status on load:', error));
  }, []);

  // Applies station selections into text box if route is selected from search history page
  React.useEffect(() => {
    // If no path selected from history, do nothing
    if (!selectedPath) {
      return;
    }

    // If path selected, apply station selections to text boxes
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

    // Clears selection so only applies transfer once
    setSelectedPath(null);
  }, [selectedPath]);

  // Searches for starting station suggestions when user types something in starting station text box
  React.useEffect(() => {
    // Doesn't search if input is too short to search for stations
    if (startQuery.trim().length < 2) {
      setStartSuggestions([]);
      return;
    }

    // Retrieves station suggestions based on user input, updates state to display suggestions
    setLoadingStart(true);
    tubeDatabase.retrieveStationSuggestions(startQuery)
      .then(setStartSuggestions)
      .catch((error) => console.error('Start suggestion failed:', error))
      .finally(() => setLoadingStart(false));
  }, [startQuery]);

  // Searches for destination station suggestions when user types something in destination station text box
  React.useEffect(() => {
    // Doesn't search if input is too short to search 
    if (destinationQuery.trim().length < 2) {
      setDestinationSuggestions([]);
      return;
    }

    // Retrieves station suggestions based on user input, updates state to display suggestions
    setLoadingDestination(true);
    tubeDatabase.retrieveStationSuggestions(destinationQuery)
      .then(setDestinationSuggestions)
      .catch((error) => console.error('Destination suggestion failed:', error))
      .finally(() => setLoadingDestination(false));
  }, [destinationQuery]);

  // Handles selection of starting station from suggestions or from search history transfer
  const handleStartStationSelection = (startStation: Station) => {
    // Saves selected start station
    setSelectedStart(startStation);

    // Applies station name to text box
    setStartQuery(startStation.name);

    // Clears suggestions
    setStartSuggestions([]);
  };

  // Handles selection of destination station from suggestions or from search history transfer
  const handleDestinationStationSelection = (destinationStation: Station) => {
    // Saves selected destination station
    setSelectedDestination(destinationStation);

    // Applies station name to text box
    setDestinationQuery(destinationStation.name);

    // Clears suggestions
    setDestinationSuggestions([]);
  };

  // Handles search button pressed
  const handleFindPath = async () => {
    // Warns user if start or destination stations are not selected, doesn't attempt to find path
    if (!selectedStart || !selectedDestination) {
      console.warn('Pick both stations before searching.');
      return;
    }

    // Logs stations being searched for
    console.log('Finding path from', selectedStart.name, 'to', selectedDestination.name);

    try {
      // Navigates to map page
      router.push('/(tabs)/map');

      // Retrieves optimal route 
      const optimalRoute = await retrieveOptimalRoute(selectedStart.id, selectedDestination.id);

      // Updates route context with optimal route to display on map
      setRouteResult(optimalRoute);

      // Logs journey into search history
      await logSearch(selectedStart.id, selectedDestination.id);
    } catch (error) {
      console.error('Failed to retrieve optimal route:', error);
    }
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#222422' }}
      headerImage={
        <Image
          source={require('../../assets/stationBanner.jpg')}
          style={styles.headerImage}
        />
      }>
      {/* Tube banner image and header */}
      <ThemedText type="title" style={styles.title}>Choose stations to plan a route.</ThemedText>

      {/* Container to handle starting station input */}
      <View style={styles.inputFieldContainer}>
        {/* Starting station text input box */}
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

        {/* Suggestions for starting station */}
        {loadingStart && <ThemedText style={styles.feedbackText}>Searching…</ThemedText>}
        {!loadingStart && selectedStart && <ThemedText style={styles.feedbackText}>Selected: {selectedStart.name}</ThemedText>}
        {selectedStart === null && (
          <ScrollView style={styles.stationSuggestions}>
            {startSuggestions.length > 0 ? (
              startSuggestions.map((station) => (
                <TouchableOpacity style={styles.stationItem} key={String(station.id)} onPress={() => handleStartStationSelection(station)}>
                  <ThemedText>{station.name}</ThemedText>
                </TouchableOpacity>
              ))
            ) : (
              (startQuery.trim().length >= 2 && !loadingStart) ? <ThemedText style={styles.feedbackText}>No matches</ThemedText> : null
            )}
          </ScrollView>
        )}
      </View>

      {/* Container to handle destination station input */}
      <ThemedView style={styles.inputFieldContainer}>
        {/* Destination station text input box */}
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

        {/* Suggestions for destination station */}
        {loadingDestination && <ThemedText style={styles.feedbackText}>Searching…</ThemedText>}
        {!loadingDestination && selectedDestination && <Text style={styles.feedbackText}>Selected: {selectedDestination.name}</Text>}
        {selectedDestination === null && (
          <ScrollView style={styles.stationSuggestions}>
            {destinationSuggestions.length > 0 ? (
              destinationSuggestions.map((station) => (
                <TouchableOpacity style={styles.stationItem} key={String(station.id)} onPress={() => handleDestinationStationSelection(station)}>
                  <ThemedText>{station.name}</ThemedText>
                </TouchableOpacity>
              ))
            ) : (
              (destinationQuery.trim().length >= 2 && !loadingDestination) ? <ThemedText style={styles.feedbackText}>No matches</ThemedText> : null
            )}
          </ScrollView>
        )}
      </ThemedView>

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
    resizeMode: 'none',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
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
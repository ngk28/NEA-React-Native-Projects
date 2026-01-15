import * as React from 'react';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { disruptionEvent } from '@/components/types';
import { getLastDisruptionFetchTime, retrieveDisruptions } from '@/components/disruptionAPI';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function DisruptionScreen() {
  const [disruptions, setDisruptions] = useState<disruptionEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<boolean>(false);

  const fetchDisruptions = async () => {
    try {
      setLoading(true);
      const data = await retrieveDisruptions();
      const fetchTime = getLastDisruptionFetchTime();
      if (fetchTime === lastUpdated) { // No new fetch data
        setFetchError(true);
        setLoading(false);
        return;
      }
      setDisruptions(data);
      setLastUpdated(fetchTime);
      setFetchError(false);
      setLoading(false);
    } catch (error) {
      console.error('Error retrieving disruptions:', error);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisruptions();

    // Timer to fetch disruption every 60 seconds
    const TIME_BETWEEN_FETCHES_IN_SECONDS = 60;
    const intervalId = setInterval(fetchDisruptions, TIME_BETWEEN_FETCHES_IN_SECONDS * 1000);

    return () => {
      clearInterval(intervalId); // Reset timer
    };
  }, []);

  const renderDisruption = ({ item }: { item: disruptionEvent }) => (
    <ThemedView style={styles.card}>
      <ThemedText type="title" style={styles.lineName}>{item.lineName}</ThemedText>
      <ThemedText type="default">Status: {item.status}</ThemedText>
      {item.reason ? (
        <ThemedText type="default" style={styles.reason}>Reason: {item.reason}</ThemedText>
      ) : null}
    </ThemedView>
  );

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle">Tube Line Disruptions</ThemedText>
      {lastUpdated && (
        <ThemedText type="default" style={styles.updated}>Last updated: {lastUpdated.toLocaleTimeString()}</ThemedText>
      )}
      {!lastUpdated && !loading && (
        <ThemedText type="default" style={styles.updated}>No disruption data available.</ThemedText>
      )}
      <FlatList
        data={disruptions}
        keyExtractor={(disruption) => disruption.lineName}
        renderItem={renderDisruption}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDisruptions} />}
        contentContainerStyle={styles.listContent}
      />
      {fetchError && !loading && (
        <View style={styles.errorPopUp}>
          <ThemedText type="default">Error fetching disruptions - Check your connection. Please try again.</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  updated: {
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dbd8d8',
  },
  lineName: {
    marginBottom: 6,
  },
  reason: {
    marginTop: 4,
  },
  errorPopUp: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#ffcccc',
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ff0000',
    alignItems: 'center',
  },
});

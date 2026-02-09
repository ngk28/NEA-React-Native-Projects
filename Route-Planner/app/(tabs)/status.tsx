import { fetchTubeStatusService, retrieveLastStatusFetchTime } from '@/components/serviceStatus';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LineStatus } from '@/components/types';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

export default function DisruptionScreen() {
  // State to hold line status data and last updated time
  const [lineStatus, setLineStatus] = useState<LineStatus[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // State to handle loading and error states during data fetch
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<boolean>(false);

  // Retrieves tube status data
  const fetchTubeStatus = async () => {
    try {
      // Queries for real-time tube status data
      setLoading(true);
      const status = await fetchTubeStatusService();
      const fetchTime = retrieveLastStatusFetchTime();

      // Handles if no new data can be fetched and cached data is outdated
      // Shows error message
      if (fetchTime === lastUpdated) {
        setFetchError(true);
        setLoading(false);
        return;
      }

      // Updates line status and last updated time states with new data
      setLineStatus(status);
      setLastUpdated(fetchTime);
      setFetchError(false);
      setLoading(false);
    } catch (error) {
      console.error('Error retrieving tube status:', error);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  // Timer to fetch tube status every 60 seconds
  useEffect(() => {
    // Initial fetch on program load
    fetchTubeStatus();

    // Sets up interval to fetch tube status every 60 seconds
    const TIME_BETWEEN_FETCHES_IN_SECONDS = 60;
    const intervalId = setInterval(fetchTubeStatus, TIME_BETWEEN_FETCHES_IN_SECONDS * 1000);

    // Reset timer
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Function to render each status item on the page
  const renderLineStatus = ({ item }: { item: LineStatus }) => (
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
      {/* Title for real-time line status page */}
      <ThemedText type="title" style={styles.title}>Real-Time Line Status</ThemedText>

      {/* Last updated time */}
      {lastUpdated && (
        <ThemedText type="default" style={styles.updated}>Last updated: {lastUpdated.toLocaleTimeString()}</ThemedText>
      )}

      {/* No data available message */}
      {!lastUpdated && !loading && (
        <ThemedText type="default" style={styles.updated}>No real-time status available.</ThemedText>
      )}

      {/* Renders status cards for each line */}
      <FlatList
        data={lineStatus}
        keyExtractor={(lineStatus) => lineStatus.lineName}
        renderItem={renderLineStatus}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTubeStatus} />}
        contentContainerStyle={styles.listContent}
      />

      {/* Error message if fetch fails */}
      {fetchError && !loading && (
        <View style={styles.errorPopUp}>
          <ThemedText type="default">Error fetching tube status - Check your connection. Please try again.</ThemedText>
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
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 8,
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

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

  // Fetches tube status on program load or every 60 seconds
  useEffect(() => {
    // Fetch tube status
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
    <ThemedView style={styles.statusCard}>
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

      {/* Shows last updated time */}
      {lastUpdated && (
        <ThemedText type="default" style={styles.updatedTimeText}>Last updated: {lastUpdated.toLocaleTimeString()}</ThemedText>
      )}

      {/* No data available message */}
      {!lastUpdated && !loading && (
        <ThemedText type="default" style={styles.updatedTimeText}>No real-time status available.</ThemedText>
      )}

      {/* Renders status for each line */}
      {/* Fetches real-time tube status if user refreshes */}
      <FlatList
        data={lineStatus}
        keyExtractor={(item) => item.lineName}
        renderItem={renderLineStatus}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTubeStatus} />}
        contentContainerStyle={styles.statusList}
      />

      {/* Shows error message if fetch failed */}
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
    paddingTop: 24,
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 8,
    alignSelf: 'center',
  },
  updatedTimeText: {
    marginBottom: 12,
    marginTop: 2,
    marginLeft: 8,
  },
  statusList: {
    paddingBottom: 24,
    width: '100%',
  },
  statusCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dbd8d8',
    marginVertical: 8,
    width: '100%',
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

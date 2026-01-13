import * as React from 'react';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { disruptionEvent, retrieveDisruptions } from '@/components/disruptionAPI';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function DisruptionScreen() {
  const [disruptions, setDisruptions] = useState<disruptionEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDisruptions = async () => {
    try {
      setLoading(true);
      const data = await retrieveDisruptions();
      setDisruptions(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error retrieving disruptions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisruptions();

    // Timer calling run every 60 seconds
    const TIME_BETWEEN_FETCHES = 60; // seconds
    const intervalId = setInterval(fetchDisruptions, TIME_BETWEEN_FETCHES * 1000);

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
      <ThemedText type="subtitle" style={styles.header}>Tube Line Disruptions</ThemedText>
      {lastUpdated && (
        <ThemedText type="default" style={styles.updated}>Last updated: {lastUpdated.toLocaleTimeString()}</ThemedText>
      )}
      <FlatList
        data={disruptions}
        keyExtractor={(disruption) => disruption.lineName}
        renderItem={renderDisruption}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDisruptions} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    marginBottom: 4,
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
});

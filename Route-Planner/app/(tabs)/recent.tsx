import { cleanUpSearchHistory, deleteSearchHistory, retrieveSearchHistory } from '@/components/searchHistoryManager';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { searchHistoryEntry, segmentKey } from '@/components/types';
import { useRoute } from '@/contexts/RouteContext';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RecentScreen() {
    const [recentSearches, setRecentSearches] = React.useState<Array<searchHistoryEntry>>([]);
    const { setPath, route } = useRoute();
    const router = useRouter();

    const fetchRecentSearches = async () => {
        try {
            const searches = await retrieveSearchHistory();
            setRecentSearches(searches);
        } catch (error) {
            console.error('Error fetching recent searches:', error);
        }
    }

    React.useEffect(() => {
        fetchRecentSearches();
        cleanUpSearchHistory(); // Clean up old entries to prevent overflow
    }, [route]);

    // Share selected path to search page
    const handleSearchAgain = (search: searchHistoryEntry) => {
        const selectedPath: segmentKey = {
            fromStationId: search.fromStationId,
            toStationId: search.toStationId,
            fromStationName: search.fromStationName,
            toStationName: search.toStationName,
        };
        setPath(selectedPath);
        router.push('/'); // Navigate back to the Search tab (index)
    }

    const clearHistory = async () => {
        try {
            await deleteSearchHistory();
            setRecentSearches([]);
        } catch (error) {
            console.error('Error clearing search history:', error);
        }
    }

    return (
        <View style={styles.container}>
            <ThemedText type="subtitle" style={styles.title}>Recent Searches</ThemedText>

            <ScrollView contentContainerStyle={styles.scrollContent} style={{ width: '100%' }}>
                {recentSearches.length === 0 && (
                    <ThemedText type="default">No recent searches found.</ThemedText>
                )}

                {recentSearches.map((search, index) => (
                    <ThemedView style={styles.card} key={index}>
                        <ThemedText type="default" style={styles.station}>{search.fromStationName} → {search.toStationName}</ThemedText>
                        <TouchableOpacity onPress={() => handleSearchAgain(search)} style={styles.searchAgainButton}>
                            <Text style={styles.searchAgainButtonText}>{'>'}</Text>
                        </TouchableOpacity>
                    </ThemedView>
                ))}
            </ScrollView>

            <TouchableOpacity onPress={() => clearHistory()} style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>Clear Search History</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 12,
    },
    title: {
        paddingTop: 24,
        fontSize: 30,
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingBottom: 24,
        paddingTop: 24,
        alignItems: 'center',
    },
    card: {
        borderRadius: 8,
        padding: 16,
        marginVertical: 8,
        borderColor: '#ccc',
        borderWidth: 1,
        width: '90%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    station: {
        maxWidth: 300,
    },
    searchAgainButton: {
        backgroundColor: '#14853c',
        height: 24,
        width: 24,
        borderRadius: 12,
        alignSelf: 'flex-end',
        marginLeft: 6,
        alignContent: 'center',
    },
    searchAgainButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: 24,
    },
    deleteButton: {
        marginTop: 16,
        marginBottom: 24,
        padding: 8,
        borderColor: '#ff0000',
        borderWidth: 1,
        borderRadius: 4,
    },
    deleteButtonText: {
        color: '#ff0000',
        fontWeight: 'bold',
    },
});
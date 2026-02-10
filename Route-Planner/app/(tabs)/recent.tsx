import { cleanUpSearchHistory, fetchSearchHistory } from '@/components/searchHistory';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RouteQuery } from '@/components/types';
import { useRoute } from '@/contexts/RouteContext';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RecentScreen() {
    // State to hold recent search history entries
    const [recentSearches, setRecentSearches] = React.useState<Array<RouteQuery>>([]);

    // Route context for sharing selected path across pages
    const { setSelectedPath, routeResult } = useRoute();

    // Router for navigation between pages
    const router = useRouter();

    // Fetches recent search history entries from database
    const fetchRecentSearches = async () => {
        try {
            const searches = await fetchSearchHistory();
            setRecentSearches(searches);
        } catch (error) {
            console.error('Error fetching recent searches:', error);
        }
    }

    // Handles search again button clicked for a search history entry
    const handleSearchAgain = (search: RouteQuery) => {
        // Shares selected past search/stations to search page
        const selectedPath: RouteQuery = {
            fromStationId: search.fromStationId,
            toStationId: search.toStationId,
            fromStationName: search.fromStationName,
            toStationName: search.toStationName,
        };
        setSelectedPath(selectedPath);

        // Navigate back to the Search tab (index)
        router.push('/');
    }

    // Handles clear history button being clicked
    const clearHistory = async () => {
        try {
            await cleanUpSearchHistory();
            setRecentSearches([]);
        } catch (error) {
            console.error('Error clearing search history:', error);
        }
    }

    // Handles new searches being added to search history
    React.useEffect(() => {
        // Updates searches shown on page (shows newly searched paths)
        fetchRecentSearches();

        // Cleans up search history by removing old searches that exceed max history entries
        cleanUpSearchHistory();
    }, [routeResult]);

    return (
        <View style={styles.container}>
            {/* Title for recent searches page */}
            <ThemedText style={styles.title}>Recent Searches</ThemedText>

            <ScrollView contentContainerStyle={styles.scrollContent} style={{ width: '100%' }}>
                {/* Shows message if no recent searches found */}
                {recentSearches.length === 0 && (
                    <ThemedText type="default">No recent searches found.</ThemedText>
                )}

                {/* Displays every recent search with a button to search again */}
                {recentSearches.map((search, index) => (
                    <ThemedView style={styles.searchHistoryCard} key={index}>
                        <ThemedText type="default" style={styles.station}>{search.fromStationName} → {search.toStationName}</ThemedText>
                        <TouchableOpacity onPress={() => handleSearchAgain(search)} style={styles.searchAgainButton}>
                            <Text style={styles.searchAgainButtonText}>{'>'}</Text>
                        </TouchableOpacity>
                    </ThemedView>
                ))}
            </ScrollView>

            {/* Button to clear search history */}
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
        paddingBottom: 24
    },
    scrollContent: {
        paddingBottom: 24,
        paddingTop: 24,
        alignItems: 'center',
    },
    searchHistoryCard: {
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
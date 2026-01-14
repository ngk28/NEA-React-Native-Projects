import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { retrieveSearchHistory, searchHistoryEntry, cleanUpSearchHistory, deleteSearchHistory } from '@/components/searchHistoryManager';
import * as React from 'react';
import { useEffect } from 'react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRoute } from '@/contexts/RouteContext';

export default function RecentScreen() {
    const [recentSearches, setRecentSearches] = React.useState<Array<searchHistoryEntry>>([]);
    const { route } = useRoute();

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

    const handleSearchAgain = (search: searchHistoryEntry) => {
        console.log('Searching again for:', search);
    }

    const clearHistory = async () => {
        try {
            await deleteSearchHistory();
            setRecentSearches([]);
            fetchRecentSearches();
        } catch (error) {
            console.error('Error clearing search history:', error);
        }
    }

    return (
        <View style={styles.container}>
            <ThemedText type="subtitle">Recent Searches</ThemedText>
            {recentSearches.map((search, index) => (
                <ThemedView style={styles.card} key={index}>
                    <ThemedText type="default">{search.fromStationName} → {search.toStationName}</ThemedText>
                    <TouchableOpacity onPress={() => handleSearchAgain(search)} style={styles.searchAgainButton}>
                        <Text style={styles.searchAgainButtonText}>{'>'}</Text>
                    </TouchableOpacity>
                </ThemedView>
            ))}
            {recentSearches.length === 0 &&
                <ThemedText type="default">No recent searches found.</ThemedText>
            }
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
        justifyContent: 'center',
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
    searchAgainButton: {
        backgroundColor: '#14853c',
        height: 24,
        width: 24,
        borderRadius: 12,
        alignSelf: 'flex-end',
        marginLeft: 6,
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
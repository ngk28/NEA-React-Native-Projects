import { Button, StyleSheet, TextInput } from 'react-native';

import { Database } from '@/components/database';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { PathFinderResult } from '@/components/pathFinder';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as React from 'react';

export default function TabTwoScreen() {
  const [searchText, onChangeSearchText] = React.useState('Search...');

  const DatabaseContext = React.createContext<Database | null>(null);

  React.useEffect(function () {
    Database.open().then((db) => {
      console.log('Database opened in context');
    }, (error) => {
      console.error('Error opening database in context: ', error);
    });

  }, []);


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
      <ThemedText> Trial  </ThemedText>

      <TextInput
        style={{
          height: 40,
        }}
        onChangeText={onChangeSearchText}
        value={searchText}
        placeholder='Starting Point'

      />
      <Button
        title="Find Path"
        onPress={() => PathFinderResult.useDijkstra(1, 10)}

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
});

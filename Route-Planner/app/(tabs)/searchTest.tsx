import { StyleSheet, TextInput } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as React from 'react';
import SQLite from 'react-native-sqlite-storage';
import { Database } from '@/components/database';

export default function TabTwoScreen() {
  const [search] = React.useState('');

  const DatabaseContext = React.createContext<Database | null>(null);

  React.useEffect(function () {

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
        onPress={() => { }}
        placeholder="Search..."
        placeholderTextColor="#888888"
        onChangeText={() => { }}
        value={search}
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

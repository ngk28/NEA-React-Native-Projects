import { Button, StyleSheet, TextInput } from 'react-native';

import { Database } from '@/components/database';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { computeShortestPath } from '@/components/pathFinder';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as React from 'react';

export default function TabTwoScreen() {


  React.useEffect(function () {
    // Database.open().then((db) => {
    //   console.log('Database opened in context');
    // }, (error) => {
    //   console.error('Error opening database in context: ', error);
    // });

  }, []);


  return (
    <ThemedText type="subtitle">Unified API</ThemedText>
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

/**
 * zustandStorage — AsyncStorage adapter for zustand's persist middleware.
 *
 * Use with createJSONStorage(() => zustandAsyncStorage) in any store
 * that needs to survive app restarts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateStorage } from 'zustand/middleware';

export const zustandAsyncStorage: StateStorage = {
  getItem:    (name)         => AsyncStorage.getItem(name),
  setItem:    (name, value)  => AsyncStorage.setItem(name, value),
  removeItem: (name)         => AsyncStorage.removeItem(name),
};

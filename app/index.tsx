import { Redirect } from 'expo-router';

// Auth temporarily disabled — go straight to the app
export default function Index() {
  return <Redirect href="/(app)" />;
}

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { Splash } from '../components/Splash';
import { C } from '../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

// Signed out → login / sign-up / forgot password.
// Customers → the 5-tab plant app. Installers, distributors and Voltra admins → the portfolio app
// (Overview / Plants / Alarms / Me); opening a plant there shows the plant app on top.
// Sub-pages (device detail, settings, …) are routes under src/app and stack on top of either.
function Root() {
  const { user, bootError, retryBoot } = useSession();
  if (user === undefined) return <Splash error={bootError?.message} onRetry={retryBoot} />;
  const business = ['installer', 'distributor', 'admin'].includes(user?.role) && user?.status === 'active';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot" />
      </Stack.Protected>
      <Stack.Protected guard={business}>
        <Stack.Screen name="(biz)" />
      </Stack.Protected>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

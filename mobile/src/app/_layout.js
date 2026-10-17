import { useEffect, useRef } from 'react';
import { Stack, router, usePathname } from 'expo-router';
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
const PUBLIC = ['/login', '/signup', '/forgot'];

function Root() {
  const { user, bootError, retryBoot, plants, plantsError, reloadPlants } = useSession();
  const path = usePathname();
  const business = ['installer', 'distributor', 'admin'].includes(user?.role) && user?.status === 'active';
  // Signed out: only the login / sign-up / forgot pages (every other route needs an account).
  useEffect(() => {
    if (user === null && !PUBLIC.includes(path)) setTimeout(() => router.replace('/login'), 0);
  }, [user, path]);
  // Just signed in (or app opened) as a partner/admin: start on the portfolio Overview, like the web app.
  const seen = useRef(null);
  useEffect(() => {
    if (user && seen.current !== user.id) {
      seen.current = user.id;
      if (business && (path === '/' || PUBLIC.includes(path))) setTimeout(() => router.replace('/overview'), 0);
    }
    if (!user) seen.current = null;
  }, [user, business]);

  if (user === undefined) return <Splash error={bootError?.message} onRetry={retryBoot} />;
  // Every plant page reads the session's plant: wait until the plant list is in.
  if (user?.status === 'active' && !plants) return <Splash error={plantsError?.message} onRetry={reloadPlants} />;
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

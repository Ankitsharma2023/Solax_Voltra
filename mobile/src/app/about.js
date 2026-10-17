import { Image, Linking, Text } from 'react-native';
import { API_URL } from '../lib/api';
import { Page, Card, List, ListRow } from '../components/ui';
import AppVersion from '../components/me/AppVersion';
import { C } from '../theme';

// About (web: About in Me.jsx). The web page's "install on your phone" steps are replaced by the
// app version and the over-the-air update check.
export default function About() {
  return (
    <Page title="About">
      <Card>
        <Image source={require('../../assets/voltra-logo.png')} style={{ width: 130, height: 57, marginBottom: 10 }} resizeMode="contain" accessibilityLabel="Voltra" />
        <Text style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>Monitor your Voltra solar and battery system. Live data comes from SolaX Cloud.</Text>
      </Card>
      <AppVersion title="App version" />
      <List>
        <ListRow title="Privacy Policy" onPress={() => Linking.openURL(`${API_URL}/privacy.html`)} />
        <ListRow title="User Terms" onPress={() => Linking.openURL(`${API_URL}/terms.html`)} />
        <ListRow title="Voltra website" sub="voltra.in" onPress={() => Linking.openURL('https://voltra.in')} last />
      </List>
    </Page>
  );
}

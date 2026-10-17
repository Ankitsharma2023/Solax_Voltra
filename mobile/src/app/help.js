import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { COMPANY, telHref } from '../lib/company';
import { Card, Page } from '../components/ui';
import { ChevronIcon } from '../components/Icons';
import { C } from '../theme';

// Help & Support (web Help in Service.jsx).
const FAQ = [
  ['Why does solar show 0 W?', 'At night or in heavy cloud the panels produce nothing. Data updates about every 5 minutes.'],
  ['What does "Battery Standby" mean?', 'The battery is neither charging nor discharging (less than 5 W).'],
  ['Why are earnings "- -"?', 'Set your electricity tariff in Me → Tariff Setting.'],
  ['What is "Offline"?', "The monitoring dongle hasn't reported recently. Check the Wi-Fi at home."],
];

export default function Help() {
  const [open, setOpen] = useState(null);
  const contact = [
    ['Website', 'voltra.in', COMPANY.website],
    COMPANY.phone && ['Phone', COMPANY.phone, telHref(COMPANY.phone)],
    COMPANY.email && ['Email', COMPANY.email, `mailto:${COMPANY.email}`],
    ['Office', COMPANY.address],
  ].filter(Boolean);
  return (
    <Page title="Help & Support">
      <Card title="Contact Voltra">
        {contact.map(([k, v, href], i) => (
          <View key={k} style={[h.kv, i < contact.length - 1 && h.line]}>
            <Text style={h.key}>{k}</Text>
            {href
              ? <Pressable onPress={() => Linking.openURL(href)} hitSlop={6} style={{ flexShrink: 1 }}><Text style={[h.val, h.link]}>{v}</Text></Pressable>
              : <Text style={h.val} selectable>{v}</Text>}
          </View>
        ))}
      </Card>
      <Card title="FAQ">
        {FAQ.map(([q, a], i) => (
          <View key={q} style={i < FAQ.length - 1 && h.line}>
            <Pressable onPress={() => setOpen(open === i ? null : i)} style={h.q} accessibilityState={{ expanded: open === i }}>
              <Text style={h.qText}>{q}</Text>
              <View style={{ transform: [{ rotate: open === i ? '90deg' : '0deg' }] }}><ChevronIcon size={18} color={C.muted} /></View>
            </Pressable>
            {open === i && <Text style={h.a}>{a}</Text>}
          </View>
        ))}
      </Card>
    </Page>
  );
}

const h = StyleSheet.create({
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  line: { borderBottomWidth: 1, borderBottomColor: C.line },
  key: { color: C.muted, fontSize: 14 },
  val: { color: C.ink, fontSize: 14, flexShrink: 1, textAlign: 'right' },
  link: { color: C.accentDark, fontWeight: '600' },
  q: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  qText: { flex: 1, fontSize: 15, color: C.ink, fontWeight: '500' },
  a: { color: C.muted, fontSize: 14, lineHeight: 20, paddingBottom: 12 },
});

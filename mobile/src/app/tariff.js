import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../lib/session';
import { usePlantSetting } from '../lib/settings';
import { DEFAULT_TARIFF, isHHMM } from '../lib/tariff-edit';
import { Page, Card, Field, Input, Segmented, Button, Note, Empty } from '../components/ui';
import { C } from '../theme';

// Tariff Setting (web: TariffSetting in Me.jsx). Saved per plant on the server (plant setting "tariff")
// and used for earnings on the Home screen, on every phone.
export default function TariffSetting() {
  const { plant } = useSession();
  if (!plant) return <Page title="Tariff Setting"><Empty>No plant selected.</Empty></Page>;
  return <Editor plant={plant} />;
}

function Editor({ plant }) {
  const [saved, save, loaded] = usePlantSetting(plant.plantId, 'tariff', null);
  const [t, setT] = useState(DEFAULT_TARIFF);
  const [ver, setVer] = useState(0); // remounts number fields when the saved tariff arrives
  useEffect(() => { if (loaded && saved) { setT({ ...DEFAULT_TARIFF, ...saved }); setVer((v) => v + 1); } }, [loaded, saved]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const setP = (i, patch) => setT({ ...t, periods: t.periods.map((p, j) => (i === j ? { ...p, ...patch } : p)) });

  async function run(value) {
    if (value && value.mode === 'tou') {
      const bad = value.periods.findIndex((p) => !isHHMM(p.start) || !isHHMM(p.end));
      if (bad >= 0) return setErr(`Period ${bad + 1}: enter times as HH:MM (24-hour), e.g. 06:00.`);
    }
    setBusy(true); setErr(null);
    try { await save(value); router.back(); } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <Page title="Tariff Setting" subtitle={plant.plantName}>
      <Card key={ver}>
        <Field label="Currency symbol">
          <Input value={t.currency} maxLength={3} onChangeText={(currency) => setT({ ...t, currency })} />
        </Field>
        <Segmented options={[['flat', 'Fixed price'], ['tou', 'Time of use']]} value={t.mode} onChange={(mode) => setT({ ...t, mode })} />
        {t.mode === 'flat' ? (
          <View style={st.grid}>
            <Num label={`Import price (${t.currency}/kWh)`} value={t.importPrice} onChange={(v) => setT({ ...t, importPrice: v })} />
            <Num label={`Export price (${t.currency}/kWh)`} value={t.exportPrice} onChange={(v) => setT({ ...t, exportPrice: v })} />
          </View>
        ) : t.periods.map((p, i) => (
          <View key={i} style={st.period}>
            <View style={st.periodHead}>
              <Text style={st.periodTitle}>Period {i + 1}</Text>
              {t.periods.length > 1 && (
                <Pressable hitSlop={8} onPress={() => { setT({ ...t, periods: t.periods.filter((_, j) => j !== i) }); setVer((v) => v + 1); }}>
                  <Text style={st.link}>Remove</Text>
                </Pressable>
              )}
            </View>
            <View style={st.grid}>
              <Time label="From" value={p.start} onChange={(start) => setP(i, { start })} />
              <Time label="To" value={p.end} onChange={(end) => setP(i, { end })} />
              <Num label="Import /kWh" value={p.importPrice} onChange={(v) => setP(i, { importPrice: v })} />
              <Num label="Export /kWh" value={p.exportPrice} onChange={(v) => setP(i, { exportPrice: v })} />
            </View>
          </View>
        ))}
        {t.mode === 'tou' && t.periods.length < 6 && (
          <Button ghost title="+ Add period" onPress={() => setT({ ...t, periods: [...t.periods, { start: '00:00', end: '23:59', importPrice: t.importPrice, exportPrice: t.exportPrice }] })} />
        )}
      </Card>
      <Note>Saved for this plant and used to calculate earnings on the Home screen, on every phone.</Note>
      {err && <Note error>{err}</Note>}
      <Button title="Save" busy={busy} onPress={() => run(t)} />
      {saved && <Button ghost title="Remove tariff" disabled={busy} onPress={() => run(null)} />}
    </Page>
  );
}

// Number field that keeps what's typed (e.g. "8." while typing) and reports a number.
function Num({ label, value, onChange }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  return (
    <View style={st.cell}>
      <Field label={label}>
        <Input value={text} keyboardType="decimal-pad" onChangeText={(v) => {
          const clean = v.replace(',', '.');
          setText(clean);
          const n = Number(clean);
          if (clean !== '' && !Number.isNaN(n) && n >= 0) onChange(n);
        }} />
      </Field>
    </View>
  );
}

function Time({ label, value, onChange }) {
  return (
    <View style={st.cell}>
      <Field label={label}>
        <Input value={value} placeholder="HH:MM" maxLength={5} keyboardType="numbers-and-punctuation"
          style={!isHHMM(value) && value.length >= 4 ? { borderColor: C.bad } : null}
          onChangeText={(v) => {
            const digits = v.replace(/[^\d]/g, '').slice(0, 4);
            onChange(v.includes(':') || digits.length < 3 ? v.replace(/[^\d:]/g, '') : `${digits.slice(0, 2)}:${digits.slice(2)}`);
          }} />
      </Field>
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cell: { width: '48.5%' },
  period: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, marginTop: 4 },
  periodHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  periodTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  link: { color: C.accentDark, fontWeight: '600' },
});

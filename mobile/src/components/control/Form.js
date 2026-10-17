import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Field, Input, Note, s as ui } from '../ui';
import { ask, sendControl, validTime } from '../../lib/control';
import { C } from '../../theme';

// Form pieces for the control screens (web: Slider, TimeField, switch-row, select, mode cards, SendBar).

// Range slider without extra packages: drag or tap the track, or use − / +.
export function Slider({ label, value, min, max, step = 1, unit = '%', digits = 0, onChange, hint }) {
  const [w, setW] = useState(0);
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const fix = (v) => Number(clamp(v).toFixed(4));
  const fromX = (x) => { if (w) onChange(fix(min + (Math.max(0, Math.min(w, x)) / w) * (max - min))); };
  const p = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={f.sliderHead}>
        <Text style={ui.text}>{label}</Text>
        <Text style={f.sliderVal}>{Number(value).toFixed(digits)}{unit === '%' ? '%' : ` ${unit}`}</Text>
      </View>
      <View style={f.sliderRow}>
        <StepBtn label="−" onPress={() => onChange(fix(value - step))} disabled={value <= min} />
        <View style={f.track} onLayout={(e) => setW(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => fromX(e.nativeEvent.locationX)} onResponderMove={(e) => fromX(e.nativeEvent.locationX)}>
          <View pointerEvents="none" style={f.rail}><View style={[f.fill, { width: `${p * 100}%` }]} /></View>
          <View pointerEvents="none" style={[f.thumb, { left: Math.max(0, p * w - 12) }]} />
        </View>
        <StepBtn label="+" onPress={() => onChange(fix(value + step))} disabled={value >= max} />
      </View>
      {!!hint && <Text style={[ui.small, { marginTop: 4 }]}>{hint}</Text>}
    </View>
  );
}
function StepBtn({ label, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={[f.step, disabled && { opacity: 0.4 }]}>
      <Text style={f.stepText}>{label}</Text>
    </Pressable>
  );
}

// Label (+ small sub line) with an on/off switch.
export function SwitchRow({ label, sub, bold, value, onChange, disabled }) {
  return (
    <View style={f.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={[ui.text, (sub || bold) && { fontWeight: '600' }]}>{label}</Text>
        {!!sub && <Text style={ui.small}>{sub}</Text>}
      </View>
      <Switch value={!!value} onValueChange={onChange} disabled={disabled}
        trackColor={{ true: C.accent, false: '#d4d9de' }} thumbColor="#fff" ios_backgroundColor="#d4d9de" />
    </View>
  );
}

// HH:MM text field with a check (web <input type="time">).
export function TimeField({ label, value, onChange, optional, style }) {
  const bad = !validTime(value, optional);
  const tidy = (t) => {
    const m = String(t).trim().match(/^(\d{1,2})[:.]?(\d{2})$/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
  };
  return (
    <View style={[{ flex: 1, minWidth: 130 }, style]}>
      <Field label={label} hint={bad ? (optional ? 'Use HH:MM (24 h) or leave empty' : 'Use HH:MM (24 h), e.g. 06:30') : null}>
        <Input value={value} placeholder={optional ? 'HH:MM (optional)' : 'HH:MM'} maxLength={5}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} autoCorrect={false}
          onChangeText={onChange} onBlur={() => value && onChange(tidy(value))}
          style={bad && { borderColor: C.bad }} />
      </Field>
    </View>
  );
}
export const TimeGrid = ({ children }) => <View style={f.grid}>{children}</View>;

// Number field that keeps what is typed ("0.", "-") and reports numbers (web <input type="number">).
export function NumField({ label, value, onChange, allowEmpty, hint, placeholder }) {
  const [text, setText] = useState(value === '' || value == null ? '' : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) { last.current = value; setText(value === '' || value == null ? '' : String(value)); }
  }, [value]);
  const change = (t) => {
    setText(t);
    const v = t.trim() === '' ? (allowEmpty ? '' : 0) : Number(t.replace(',', '.'));
    if (v === '' || !Number.isNaN(v)) { last.current = v; onChange(v); }
  };
  return (
    <Field label={label} hint={hint}>
      <Input value={text} onChangeText={change} placeholder={placeholder}
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'} />
    </Field>
  );
}

// A small set of options as wrapping pills (web <select>).
export function Choice({ label, options, value, onChange }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {!!label && <Text style={ui.fieldLabel}>{label}</Text>}
      <View style={f.chips}>
        {options.map((o) => {
          const [id, text] = Array.isArray(o) ? o : [o, o];
          const on = id === value;
          return (
            <Pressable key={String(id)} onPress={() => onChange(id)} style={[f.chip, on && f.chipOn]}>
              <Text style={[f.chipText, on && f.chipTextOn]}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Selectable card with a radio dot (web .card.mode).
export function RadioCard({ title, desc, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={[f.mode, on && f.modeOn]}>
      <View style={[f.radio, on && f.radioOn]}>{on && <View style={f.radioDot} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={ui.rowTitle}>{title}</Text>
        {!!desc && <Text style={ui.muted}>{desc}</Text>}
      </View>
    </Pressable>
  );
}

// Button + confirmation + result line shared by every control screen (web SendBar).
export function SendBar({ plant, op, params, caps, confirmText, label = 'Apply to inverter', onSaved, disabled, history = true }) {
  const [state, setState] = useState(null);
  const allowed = caps?.ops?.[op] && caps?.mayControl;
  async function go() {
    if (!(await ask(confirmText, { ok: label }))) return;
    setState({ busy: true });
    try {
      const e = await sendControl(plant.plantId, op, params);
      setState({ ok: true, text: `Sent ✓ — ${e.statusText}. Check Command History for the result.` });
      onSaved?.();
    } catch (err) { setState({ err: true, text: err.message }); }
  }
  return (
    <View style={{ marginTop: 4 }}>
      {!!state?.text && <Note ok={state.ok} error={state.err}>{state.text}</Note>}
      {!allowed && <Note>{!caps ? 'Checking permissions…' : !caps.mayControl ? 'Your account can view this plant but not change its settings.' : 'Commands to the inverter are not switched on yet. Settings are saved for this plant.'}</Note>}
      <Button title={state?.busy ? 'Sending…' : label} busy={state?.busy} danger disabled={!allowed || disabled} onPress={go} />
      {history && (
        <Pressable onPress={() => router.push('/control/history')} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 12 }}>
          <Text style={f.link}>Command History ›</Text>
        </Pressable>
      )}
    </View>
  );
}

// Small coloured pill (web .badge.normal / .alarm / .pending / .offline).
const TONES = { normal: [C.accentSoft, C.accentDark], alarm: [C.badSoft, C.bad], pending: ['#fff6e5', '#b7791f'], offline: [C.soft, C.muted] };
export function ToneBadge({ tone = 'offline', children }) {
  const [bg, fg] = TONES[tone] || TONES.offline;
  return <Text style={[ui.badge, { backgroundColor: bg, color: fg }]}>{children}</Text>;
}

export const f = StyleSheet.create({
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 },
  sliderVal: { fontSize: 15, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 36, justifyContent: 'center' },
  rail: { height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: C.accent },
  thumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', borderWidth: 2, borderColor: C.accent,
    shadowColor: '#111827', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  step: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, color: C.ink, lineHeight: 22 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff' },
  chipOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  chipText: { fontSize: 14, color: C.ink2 },
  chipTextOn: { color: C.accentDark, fontWeight: '600' },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', marginBottom: 10 },
  modeOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c4cad1', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent },
  link: { color: C.accentDark, fontWeight: '600', fontSize: 14 },
});

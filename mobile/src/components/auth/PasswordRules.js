import { StyleSheet, Text, View } from 'react-native';
import { C } from '../../theme';

// Live checklist under a new-password field (the server's checkPasswordStrength rules).
export function PasswordRules({ value }) {
  if (!value) return null;
  const rules = [
    ['8+ characters', value.length >= 8],
    ['letters', /[A-Za-z]/.test(value)],
    ['numbers', /\d/.test(value)],
  ];
  return (
    <View style={r.row}>
      {rules.map(([label, ok]) => (
        <Text key={label} style={[r.rule, ok && r.ok]}>{ok ? '✓' : '•'} {label}</Text>
      ))}
      {value !== value.trim() && <Text style={[r.rule, { color: C.bad }]}>no spaces at start/end</Text>}
    </View>
  );
}

const r = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  rule: { fontSize: 12, color: C.muted },
  ok: { color: C.accentDark },
});

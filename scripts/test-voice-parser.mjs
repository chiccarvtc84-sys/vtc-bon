// Tests du parser vocal — lance avec : node scripts/test-voice-parser.mjs
import { parseVoiceCommand } from '../src/lib/voiceParser.js';

const cases = [
  {
    label: 'Dictée brute argot',
    input: 'dupont marseille avignon tgv 100 bornes 180 balles',
    expect: {
      customerName: 'Dupont',
      pickupAddress: 'Marseille',
      dropoffAddress: 'Avignon TGV',
      distance: 100,
      price: 180,
    },
  },
  {
    label: 'Avec fillers et "vers"',
    input: 'euh fais une course pour martin lyon vers avignon tgv',
    expect: {
      customerName: 'Martin',
      pickupAddress: 'Lyon',
      dropoffAddress: 'Avignon TGV',
    },
  },
  {
    label: 'Format minimal',
    input: 'bernard nimes avignon tgv',
    expect: {
      customerName: 'Bernard',
      pickupAddress: 'Nîmes',
      dropoffAddress: 'Avignon TGV',
    },
  },
  {
    label: 'Phrase complète riche',
    input: 'Récupérer Mme Dubois à Avignon centre pour la gare TGV à 12h50, ils seront 3 avec valises',
    expect: {
      customerName: 'Dubois',
      pickupAddress: 'Avignon Centre',
      dropoffAddress: 'Avignon TGV',
      time: '12:50',
      passengers: 3,
      hasLuggage: true,
    },
  },
  {
    label: 'Fautes phonétiques',
    input: 'marseye lion 350 km',
    expect: {
      pickupAddress: 'Marseille',
      dropoffAddress: 'Lyon',
      distance: 350,
    },
  },
  {
    label: '"Fais le bon" + structure libre',
    input: 'bon alors fais le bon pour madame durand depuis sorgues vers cdg',
    expect: {
      customerName: 'Durand',
      pickupAddress: 'Sorgues',
      dropoffAddress: 'Paris Charles de Gaulle',
    },
  },
  {
    label: 'Prix sans unité claire',
    input: 'rossi cavaillon orange 45 euros',
    expect: {
      customerName: 'Rossi',
      pickupAddress: 'Cavaillon',
      dropoffAddress: 'Orange',
      price: 45,
    },
  },
  {
    label: 'Heure compacte',
    input: 'martin avignon arles 14:30',
    expect: {
      customerName: 'Martin',
      pickupAddress: 'Avignon',
      dropoffAddress: 'Arles',
      time: '14:30',
    },
  },
];

let passed = 0;
let failed = 0;
const failures = [];

for (const c of cases) {
  const got = parseVoiceCommand(c.input);
  let ok = true;
  const mismatches = [];
  for (const [k, v] of Object.entries(c.expect)) {
    if (JSON.stringify(got[k]) !== JSON.stringify(v)) {
      ok = false;
      mismatches.push(`${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(got[k])}`);
    }
  }
  if (ok) {
    passed++;
    console.log(`✓ ${c.label}`);
  } else {
    failed++;
    failures.push({ label: c.label, input: c.input, got, mismatches });
    console.log(`✗ ${c.label}`);
    for (const m of mismatches) console.log(`    ${m}`);
  }
}

console.log(`\n${passed}/${cases.length} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n--- Détail des échecs ---');
  for (const f of failures) {
    console.log(`\n[${f.label}]`);
    console.log(`  input: "${f.input}"`);
    console.log(`  got:   ${JSON.stringify(f.got, null, 2)}`);
  }
  process.exit(1);
}

const SCHEMA_EVOLUTION_RULES = [
  {
    action: 'Add new field with a new tag number (e.g. string bio = 18;)',
    wireImpact: 'Old binaries ignore unknown field tags; new binaries parse it.',
    isSafe: true,
    explanation:
      'Backward & forward compatible. When an old client receives a message containing the new field, it preserves it in unknown fields without crashing.',
  },
  {
    action: 'Change a field name (e.g. name = 1 -> full_name = 1)',
    wireImpact: 'Wire format is 100% IDENTICAL because tags, not names, are transmitted.',
    isSafe: true,
    explanation:
      'Safe on the wire. However, application code in dynamic languages (or proto-loader with keepCase: true) will see a changed object property.',
  },
  {
    action: 'Change a field number (e.g. string name = 1 -> string name = 2)',
    wireImpact: 'BREAKING CHANGE. Old code writes tag 1; new code expects tag 2.',
    isSafe: false,
    explanation:
      'Never do this. To new readers, tag 1 is unrecognized (dropped), and tag 2 is missing (defaults to empty). Data is silently lost.',
  },
  {
    action: 'Delete a field WITHOUT reserving the tag number',
    wireImpact: 'HIGH RISK. If a future engineer reuses tag 1 for an int32, old clients will corrupt data.',
    isSafe: false,
    explanation:
      'Always mark deleted tags as "reserved <tag_number>;" and "reserved <field_name>;". This causes the protobuf compiler to error if anyone attempts to reuse the slot.',
  },
  {
    action: 'Change int32 to int64',
    wireImpact: 'Compatible on the wire (both use varint encoding).',
    isSafe: true,
    explanation:
      'Safe on the wire. However, in JavaScript, ensure you use longs=String in proto-loader, otherwise integers > 2^53 - 1 will suffer precision loss.',
  },
  {
    action: 'Add a new enum value to an existing enum',
    wireImpact: 'Older clients receiving the new value will see it as an unrecognized integer (or default 0).',
    isSafe: true,
    explanation:
      'Safe if the zero value of the enum is explicitly UNSPECIFIED and code handles unknown variants gracefully.',
  },
];

function printEvolutionGuide() {
  console.log('\n======================================================');
  console.log('PROTOCOL BUFFERS SCHEMA EVOLUTION CHEAT SHEET');
  console.log('======================================================\n');

  for (const rule of SCHEMA_EVOLUTION_RULES) {
    const icon = rule.isSafe ? '✅ SAFE' : '❌ BREAKING / UNSAFE';
    console.log(`${icon}: ${rule.action}`);
    console.log(`  Wire: ${rule.wireImpact}`);
    console.log(`  Why:  ${rule.explanation}\n`);
  }
}

if (require.main === module) {
  printEvolutionGuide();
}

module.exports = {
  SCHEMA_EVOLUTION_RULES,
  printEvolutionGuide,
};

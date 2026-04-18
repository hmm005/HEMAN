const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const database = require('../db/database');

function leadId(firstName, lastName, address) {
  const key = `${firstName}|${lastName}|${address}`.toLowerCase().trim();
  return crypto.createHash('md5').update(key).digest('hex').slice(0, 16);
}

function colGet(row, ...names) {
  for (const name of names) {
    const key = Object.keys(row).find(k => k.trim().toLowerCase() === name.toLowerCase());
    if (key && row[key] && row[key].trim()) return row[key].trim();
  }
  return '';
}

function mapRow(row, sourceFile) {
  const firstName = colGet(row, 'First Name', 'FirstName', 'first_name');
  const lastName = colGet(row, 'Last Name', 'LastName', 'last_name');
  const address = colGet(row, 'Property Address', 'Address', 'property_address', 'Mailing Address');

  return {
    id: leadId(firstName, lastName, address),
    first_name: firstName,
    last_name: lastName,
    property_address: address,
    city: colGet(row, 'City', 'city'),
    state: colGet(row, 'State', 'state'),
    zip: colGet(row, 'Zip', 'Zip Code', 'zip', 'Postal Code'),
    email: colGet(row, 'Email', 'Email Address', 'email'),
    phone: colGet(row, 'Phone 1', 'Phone', 'phone', 'Phone Number'),
    property_type: colGet(row, 'Property Type', 'property_type', 'Type'),
    estimated_value: parseFloat(colGet(row, 'Estimated Value', 'Value', 'estimated_value').replace(/[$,]/g, '')) || 0,
    equity: parseFloat(colGet(row, 'Equity', 'equity').replace(/[$,]/g, '')) || 0,
    source_file: sourceFile,
    notes: '',
  };
}

function importCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
  const sourceFile = path.basename(filePath);

  let imported = 0, skipped = 0;

  for (const row of rows) {
    const lead = mapRow(row, sourceFile);
    if (!lead.property_address) { skipped++; continue; }

    const result = database.upsertLead(lead);
    if (result.changes > 0) imported++;
    else skipped++;
  }

  console.log(`\n✅ Import complete from ${sourceFile}`);
  console.log(`   ${rows.length} rows read → ${imported} imported, ${skipped} skipped (duplicates / missing address)\n`);
}

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node src/outreach/csvImport.js <path/to/leads.csv>');
    process.exit(1);
  }
  try {
    importCsv(path.resolve(filePath));
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exit(1);
  }
}

module.exports = { importCsv };

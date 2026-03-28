require('dotenv').config();
const { createServer } = require('./server/server');
const database = require('./db/database');

const PORT = parseInt(process.env.PORT) || 3001;

// Ensure database is initialized
database.init();

const app = createServer();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏠 Driving for Dollars is running!`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://0.0.0.0:${PORT}`);
  console.log(`\n   Open on your iPhone and "Add to Home Screen" for the full app experience.\n`);
});

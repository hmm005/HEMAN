const path = require('path');

module.exports = {
  apps: [
    {
      name: 'deal-dashboard',
      script: path.join(__dirname, 'src', 'index.js'),
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
      error_file: path.join(__dirname, 'data', 'logs', 'error.log'),
      out_file: path.join(__dirname, 'data', 'logs', 'out.log'),
      time: true,
    },
  ],
};

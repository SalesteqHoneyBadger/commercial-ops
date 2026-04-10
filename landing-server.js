const express = require('express');
const path = require('path');

const app = express();
const PORT = 3080;

// Serve static files from landing directory
app.use(express.static(path.join(__dirname, 'landing')));

// Serve index.html for all routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Automotive landing page deployed at http://localhost:${PORT}`);
  console.log(`📡 Accessible as automotive.salesteq.com on port ${PORT}`);
});
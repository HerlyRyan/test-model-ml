const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Import modules
const { setupDatabase } = require('./database');
const { setupRoutes } = require('./handler');

// Setup database connection
setupDatabase();

// Setup routes and middleware
setupRoutes(app);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

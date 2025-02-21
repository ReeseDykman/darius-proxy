const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Enable CORS for all origins (adjust as needed)
app.use(cors());


// Set up the proxy middleware.
// All requests to '/' are forwarded to your target endpoint.
app.use(
  '/',
  createProxyMiddleware({
    target: 'https://reesedykman.app.n8n.cloud', // Base URL of your target
    changeOrigin: true, // Needed for virtual hosted sites
    pathRewrite: {
      '^/': '/webhook-test/48b04ec2-cc83-452f-9d29-5a4380d4aeb1' // Rewrite the path to match your endpoint
    }
  })
);

app.post('/response', (req, res) => {
  console.log('Response received');
})

// Start the proxy server on port 8080 (or your preferred port)
const PORT = process.env.PORT || 8080;
const listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});

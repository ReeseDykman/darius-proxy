const express = require('express');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
// For Node versions < 18 or if using node-fetch v3 in CommonJS:
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json()); // for parsing JSON bodies in callbacks

// Use Multer to handle file uploads (store files in memory)
const upload = multer({ storage: multer.memoryStorage() });

// In-memory stores for job results and waiting resolvers
const jobResults = {};     // { jobId: result }
const jobResolvers = {};   // { jobId: resolve }

// Endpoint 1: Upload files (from the front end)
app.post('/upload', upload.array('files'), async (req, res) => {
  // Create a unique job ID for this upload
  const jobId = uuidv4();

  // Build FormData to forward to the external service
  const formData = new FormData();
  // Append the files as received
  req.files.forEach(file => {
    formData.append('files', file.buffer, file.originalname);
  });
  // Include the jobId so that the external service can send it back
  formData.append('jobId', jobId);

  try {
    // Forward the files to the external service
    // (Replace the target URL below with your actual external service endpoint)
    await fetch('https://reesedykman.app.n8n.cloud/webhook-test/48b04ec2-cc83-452f-9d29-5a4380d4aeb1', {
      method: 'POST',
      headers: formData.getHeaders(),
      body: formData,
      // Increase timeouts as needed for long processing
    });
  } catch (error) {
    console.error("Error forwarding upload:", error);
    // Optionally, you might choose to return an error here instead of a job ID
  }

  // Respond immediately with the job ID
  res.json({ jobId });
});

// Endpoint 2: External service callback
// This endpoint is called by the external service when processing is complete.
app.post('/callback/:jobId', (req, res) => {
  const { jobId } = req.params;
  const result = req.body; // assume the external service sends JSON
  console.log(`Received callback for job ${jobId}:`, result);
  jobResults[jobId] = result;
  if (jobResolvers[jobId]) {
    // Resolve any waiting GET /result request
    jobResolvers[jobId](result);
    delete jobResolvers[jobId];
  }
  res.sendStatus(200);
});

// Endpoint 3: Get result
// The front end calls this to retrieve the result.
app.get('/result/:jobId', async (req, res) => {
  const { jobId } = req.params;
  // If we already have a result, return it immediately
  if (jobResults[jobId]) {
    return res.json(jobResults[jobId]);
  }

  // Otherwise, wait until the callback arrives.
  // We'll use a Promise that resolves when jobResolvers[jobId] is called.
  try {
    const result = await new Promise((resolve, reject) => {
      jobResolvers[jobId] = resolve;
      // Optionally, timeout after a certain period (e.g., 5 minutes)
      setTimeout(() => {
        if (jobResolvers[jobId]) {
          delete jobResolvers[jobId];
          reject(new Error('Timeout waiting for job result'));
        }
      }, 300000); // 300000ms = 5 minutes
    });
    res.json(result);
  } catch (error) {
    console.error(`Error waiting for job ${jobId}:`, error);
    res.status(504).json({ error: error.message });
  }
});

// Start the proxy server on port 8080 (or any port you choose)
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy server is running on http://localhost:${PORT}`);
});

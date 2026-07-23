// src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Import our controllers
import { getCascadeTree, searchNodes ,getRootDeficiencies} from './controllers/graphController';
import { semanticSearch } from './controllers/searchController';
import { findShortestPath } from './controllers/pathfnderController';

// Inside src/index.ts
import { generateAISummary } from './controllers/aiController';
import { getMultiCascade } from './controllers/graphController';

import multer from 'multer';
import { parseLabReport } from './controllers/uploadController';

// 🔥 1. IMPORT REDIS AND MIDDLEWARE
import { connectRedis } from './redis';
import { cacheMultiCascade } from './middleware/cacheMiddleware';

// Setup Multer to store files temporarily in RAM (Memory)
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// Add this POST route (allows up to 5 files at once)
app.post('/api/parse-report', upload.array('files', 5), parseLabReport);

// --- ROUTES ---

// 🔥 2. INJECT CACHE MIDDLEWARE BEFORE THE CONTROLLER
app.post('/api/cascade/multi', cacheMultiCascade, getMultiCascade);

// 1. Graph Data Endpoint
app.post('/api/ai-summary', generateAISummary);

app.get('/api/roots', getRootDeficiencies);

app.get('/api/cascade/:id', getCascadeTree);

app.get('/api/pathfinder', findShortestPath);

// 2. Standard Text Search (Fallback)
app.get('/api/search', searchNodes);

// 3. New AI Semantic Vector Search
app.get('/search/semantic', semanticSearch);

// --- ERROR HANDLING ---

// Prevent Express from returning HTML error pages on 404s
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found.` });
});

// Global error catcher to prevent server crashes
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

// 🔥 3. INITIALIZE REDIS CONNECTION ON SERVER START
app.listen(PORT, async () => {
  await connectRedis();
  console.log(`🚀 Backend API running actively on http://localhost:${PORT}`);
});
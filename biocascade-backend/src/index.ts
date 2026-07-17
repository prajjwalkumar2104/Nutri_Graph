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

// ... other routes ...


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --- ROUTES ---

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
app.listen(PORT, () => {
  console.log(`🚀 Backend API running actively on http://localhost:${PORT}`);
});
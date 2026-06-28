// src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getCascadeTree ,searchNodes} from './controllers/graphController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Graph endpoint for tracing dependencies
app.get('/api/search', searchNodes);
app.get('/api/cascade/:id', getCascadeTree);

app.listen(PORT, () => {
  console.log(`BioCascade API running on http://localhost:${PORT}`);
});
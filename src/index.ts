import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { candidateRoutes } from './routes/candidates';
import { letterRoutes } from './routes/letters';
import { generateRoutes } from './routes/generate';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['https://jobsreport.online', 'https://coverletter.jobsreport.online'] }));
app.use(express.json({ limit: '5mb' }));

// Routes
app.use('/api/candidates', candidateRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/generate', generateRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'coverletter-api' });
});

app.listen(PORT, () => {
  console.log(`🚀 CoverLetter API running on port ${PORT}`);
});

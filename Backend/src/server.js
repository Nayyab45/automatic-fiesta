import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and set one.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));

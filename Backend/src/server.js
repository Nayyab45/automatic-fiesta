import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { restaurantsRouter } from './routes/restaurants.js';
import { tablesRouter, seatRequestsRouter } from './routes/tables.js';
import { profileRouter, interestsRouter, peopleRouter, matchesRouter } from './routes/profile.js';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and set one.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/restaurants', restaurantsRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/seat-requests', seatRequestsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/interests', interestsRouter);
app.use('/api/people', peopleRouter);
app.use('/api/matches', matchesRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));

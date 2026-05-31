# World Cup Predictor 2026

A private prediction pool for the 2026 FIFA World Cup. Players log in, submit picks for group-stage and knockout matches, and compete on a live leaderboard. An admin enters real results as the tournament progresses.

## Features

- **Predictions** — Group-stage scores, group rankings, and knockout bracket picks
- **Leaderboard** — Automatic scoring based on match results, rankings, and knockout picks
- **Dashboard** — Overview of your score and open prediction rounds
- **Admin panel** — Enter actual match results and knockout outcomes

## Tech stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Supabase](https://supabase.com/) (database & auth)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure Supabase**

   Copy `.env.example` to `.env` and add your Supabase project URL and anon key (from **Project Settings → API** in the Supabase dashboard):

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Create the database**

   Run `supabase/schema.sql` in the Supabase SQL Editor to create tables and seed players.

4. **Start the dev server**

   ```bash
   npm run dev
   ```

## Scripts

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Production build         |
| `npm run preview` | Preview production build |

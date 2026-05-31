# World Cup Predictor 2026 — Deployment Guide
# ================================================
# Total time: ~30 minutes | Cost: FREE

---

## STEP 1 — Create your Supabase database (10 min)

1. Go to https://supabase.com and click **Start for free**
2. Sign up with GitHub or email
3. Click **New project**
   - Name: `worldcup-predictor`
   - Password: choose a strong one (save it!)
   - Region: pick the closest to you (e.g. EU West)
   - Click **Create new project** and wait ~2 minutes

4. Once ready, go to **SQL Editor** (left sidebar, </> icon)
5. Click **+ New query**
6. Open the file `supabase/schema.sql` from this project
7. **Paste the entire contents** into the editor
8. Click **Run** (green button)
   ✅ You should see "Success. No rows returned"

9. Go to **Project Settings** (⚙️ gear icon, bottom left) → **API**
10. Copy two values — you'll need them in Step 3:
    - **Project URL** (looks like: https://abcdefgh.supabase.co)
    - **anon public** key (long string starting with eyJ...)

---

## STEP 2 — Get the app code onto GitHub (5 min)

1. Go to https://github.com and sign in (or create a free account)
2. Click **+** → **New repository**
   - Name: `worldcup-predictor`
   - Visibility: **Private** ✅
   - Click **Create repository**

3. On your computer, open a terminal in the project folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/worldcup-predictor.git
git push -u origin main
```

---

## STEP 3 — Deploy to Vercel (5 min)

1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New Project**
3. Find and import your `worldcup-predictor` repository
4. Under **Environment Variables**, add these two:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | https://YOUR_PROJECT.supabase.co |
   | `VITE_SUPABASE_ANON_KEY` | eyJ... (your anon key) |

5. Click **Deploy**
6. Wait ~1 minute — Vercel builds and deploys automatically
7. You'll get a URL like: `https://worldcup-predictor.vercel.app`

🎉 **Your app is live!**

---

## STEP 4 — Share with your group

Send the URL to everyone and tell them their login credentials:

| Name     | Default Password |
|----------|-----------------|
| David    | david123        |
| Dorian   | dorian123       |
| Antonia  | antonia123      |
| Irma     | irma123         |
| Laura    | laura123        |
| Dorus    | dorus123        |
| Sandra   | sandra123       |
| Hilde    | hilde123        |
| Eric     | eric123         |
| Claude   | claude123       |
| Admin    | admin2026!      |

⚠️  **Change these passwords!** To update passwords, go to:
Supabase Dashboard → Table Editor → players → edit each row

The **Admin** login is for the organizer to enter results and set the deadline.
Everyone else is a regular player.

---

## HOW IT WORKS

**Players:**
- Log in with their name + password from any device
- Submit predictions for: match scores, group rankings, knockout picks
- Predictions auto-lock after the deadline you set

**Organizer (Admin login):**
- Sets the submission deadline
- Enters actual results match by match as they happen
- Scores calculate automatically

**Scoring:**
- ⚽ 10pts correct result (W/D/L)
- ⚽ +10pts exact score bonus (20pts total)
- ⚽ +10pts correct goal difference (always, even if result wrong)
- 📊 10pts per team in correct group position
- 🏆 10pts per team reaching R32
- 🏆 20pts per team reaching R16
- 🏆 30pts per team reaching QF
- 🏆 40pts per team reaching SF
- 🏆 50pts per team reaching the Final

**Privacy:**
- Predictions are hidden from everyone until the deadline passes
- The leaderboard shows scores but not individual picks (pre-deadline)
- All data stored securely in your private Supabase database

---

## MAKING CHANGES LATER

Any time you push to GitHub, Vercel redeploys automatically within ~1 minute.

To change team names, passwords, or scoring — edit the source files and push.

---

## TROUBLESHOOTING

**"Invalid API key"** → Check your VITE_SUPABASE_ANON_KEY in Vercel environment variables

**"relation does not exist"** → The SQL schema wasn't run correctly. Re-run schema.sql in Supabase SQL Editor.

**Blank page after deploy** → Check Vercel build logs for errors. Most common cause: missing environment variables.

**Predictions not saving** → Check browser console for errors. Make sure Supabase RLS policies were created by the schema.

---
Need help? The two services have good free support:
- https://supabase.com/docs
- https://vercel.com/docs

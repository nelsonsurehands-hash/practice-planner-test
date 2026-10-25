# Coach Practice Planner

A web app for coaching staffs: basketball, volleyball, soccer, football, baseball/softball, or any other sport. It does five things:

- **Practice plans:** timed practices with a minutes meter so a plan never runs past the end of practice. Each drill block can be assigned to a coach (handy for stations).
- **Drill library:** drills that can have more than one category. Categories match the team's sport.
- **Plays:** a drawing board for the team's sport (half court, volleyball court, half field, football field or diamond) with multi-step plays you can play through as an animation.
- **Printing:** black-and-white PDFs of practice plans and plays.
- **Staffs:** head coaches invite assistants (who can edit) and managers or players (view only). Coaches can be on several staffs and sports, and switch between them from the team menu.

Each team has its own sport, name, colors, season, games and days off.

It's plain HTML, CSS and JavaScript with no build step. Data lives in [Supabase](https://supabase.com) (Postgres plus sign-in), and the files can be hosted anywhere that serves static files.

```
index.html              app page
css/app.css             styles
js/config.js            your Supabase URL and key (the only file you edit)
js/store.js             saving and loading (Supabase, or this browser in demo mode)
js/sports.js            sports: categories, play types, courts and fields
js/app.js               planner, drill library, play board, PDFs
js/board.js             play diagrams and play-through animation (shared)
js/boot.js              sign-in, teams and staffs, Settings, copying, sharing, backups
playbook.html, js/playbook.js   the player view that share links open
sw.js, manifest.webmanifest, icons/   installable app and offline support
supabase/schema.sql     database tables and security rules
data/                   your existing data, ready to import
```

---

## 1. Try it locally (demo mode, 2 minutes)

With `js/config.js` left empty, the app runs in **demo mode**: there's no sign-in, and data is saved only in that browser.

```bash
cd coach-app
python3 -m http.server 8080
# open http://localhost:8080
```

Opening `index.html` straight from the folder also works, but offline support needs a server.

## 2. Create the database (Supabase, about 10 minutes)

1. Sign up at supabase.com and create a **New project**. The free tier is plenty for a few teams. Pick a region near you, such as US Central.
2. Go to **SQL Editor → New query**, paste all of `supabase/schema.sql`, and click **Run**. It's safe to run again later.
3. Go to **Authentication → Sign In / Providers** and make sure **Email** is enabled. Coaches sign in with a magic link, so there are no passwords to manage.
4. Go to **Authentication → URL Configuration**:
   - **Site URL:** your app's address, e.g. `https://practice.yourdomain.com`.
   - **Redirect URLs:** add the same address. Add `http://localhost:8080` too if you test locally.
5. Go to **Project Settings → API**, copy the **Project URL** and the **anon public** key, and put them in `js/config.js`:

```js
window.APP_CONFIG = {
  supabaseUrl: "https://abcd1234.supabase.co",
  supabaseAnonKey: "eyJhbGciOi..."
};
```

The anon key is meant to be public. The row-level security rules in `schema.sql` make sure each coach can only read and change their own teams' data.

**Email limits:** Supabase's built-in email sender is for testing and only sends a few sign-in emails per hour. Before inviting other coaches, go to **Authentication → Emails → SMTP Settings** and connect a real sender such as Resend, Postmark, SendGrid or Amazon SES. You can also customize the magic-link email template there.

## 3. Host it (pick one)

The app is a folder of static files, so any of these work:

- **Netlify:** drag the `coach-app` folder onto app.netlify.com/drop, then set a custom domain.
- **Cloudflare Pages:** create a project, upload the folder, and choose "no build command".
- **Your own server:** copy the folder to any directory that nginx or Apache serves. It needs HTTPS for sign-in and the installable app to work.
- **GitHub Pages:** push the folder to a repo and turn on Pages.

After hosting, update the **Site URL** in Supabase (step 2.4) to match.

**Deploying updates:** when you change files, bump `VERSION` in `sw.js` (e.g. `cpp-v2`) so phones pick up the new version.

## 4. Set up your team

1. Open the app, enter your email, and tap the link in the email.
2. **Create team:** pick your sport and enter your school and team name. Tick **Add starter drills** if you want a few to start with.
3. **Bring in existing data (optional):** go to **Settings → Your data → Import backup** and choose a backup file. It can be one downloaded from this app, or the **Export backup** file from the Claude practice planner. Tick **"Also use this backup's team settings"** to bring over the season, games and colors too.

In demo mode, **Explore with sample team** on the setup screen loads a made-up team (Riverside Ravens) with drills, three plays and a practice plan, so you can try everything in one tap.

## 5. Build your staff

**Settings → Coaching staff** shows two 6-letter codes:

| Code | Who it's for | What they can do |
|---|---|---|
| **Staff code** | Assistant coaches | Edit plans, drills, plays and team settings |
| **View-only code** | Team managers, trainers, players | Browse, play through and print. They can't change anything. |

People open the app, sign in, choose **Join a staff** from the team menu (or the setup screen), and enter a code.

**Head coaches (owners) can:**
- **Change roles:** set anyone to head coach, coach or view only. A team always keeps at least one head coach.
- **Set titles:** "JV Coach", "Defensive Coordinator" and so on.
- **Remove people.**
- **Issue new codes:** the old code stops working right away.

Everyone sets their own name under **Settings → Account**. That name shows on "Last edited by", on "Led by" for drill blocks, and in the staff list.

While coaches have the planner open, a line under the header shows who else is in it and what they're looking at (e.g. "Also here: Coach Sam planning Mon, Nov 2"). Changes show up on everyone's screen live.

## 6. More teams, more sports

- **New team:** open the team menu at the top right and choose **+ New team**. Pick the sport when you create it. Each team is its own staff with its own drills, plays, plans, season and codes, so you can coach 8th grade basketball and JV volleyball from one sign-in.
- **Copy to team:** drills, plays and practice plans have a **Copy to team** button that sends a copy to another team you coach. Plays only copy to teams with the same sport. A copied plan goes onto the date you pick.
- **Changing sport:** an existing team's sport can be changed in Settings. Drill categories and the play board change with it.

## 7. Share plays with players

On the **Plays** tab, tap **Share with players**. Pick the plays (all are selected to start), name the playbook (e.g. "Ravens Offense"), and tap **Create player link**. Copy the link, or tap **Send…** on a phone, and text, email or post it in your team app.

Players open the link on any phone or computer. They don't need an account or sign-in. They get:

- **Play list:** every play in the playbook, grouped by type, with search.
- **Each play:** step-by-step diagrams with your captions (tap or swipe through the steps), **Play through** to watch it run, and your play notes.

They never see practice plans, drills, schedules or the staff list. The page is view-only.

**Managing links:** the dialog lists every player link with how many times it's been opened. **Turn off** stops a link right away (handy when a season ends or a link gets passed around), and **Turn on** brings it back. Edits to the plays show up on the player page automatically, so you don't need a new link after changing a play.

Hosted links are short, like `yoursite.com/playbook.html?pb=K7q2MxAb9Z`.

**In demo mode** (no Supabase) there's no server, so the plays are packed into the link itself. The link is long (about 5,000 characters for 8 plays), and later edits don't show until you make a new link. **In the Claude phone preview** there's no web address at all, so the button becomes **Preview player view** and shows you the player page instead of making a link.

## 8. Install on a phone

- **iPhone:** open the app in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open it in Chrome, tap the menu, then **Install app**.

It opens full-screen like a regular app. If the gym has no signal it still opens, but changes need a connection to save.

---

## Publishing updates

Every time you publish a change, edit the number in `version.js` (any new value works, e.g. `2026.10.19-1`).
Open copies of the app, including the one on a coach's home screen, check that file when they open,
when someone switches back to them, and every 10 minutes. When the number changes they refresh
themselves. If a coach is in the middle of something unsaved, they get an "Update now" bar instead.
Nobody needs to reload, sign in again or re-add the app. (A new app icon is the one exception:
phones keep the old icon until the app is re-added to the home screen.)

## How the data is stored

| Table | What's in it |
|---|---|
| `teams` | Name, staff and view-only codes, and `settings` (sport, school, team name, colors, practice times, season, practice days, games, special days) |
| `team_members` | Who is on which team: role (`owner`, `coach` or `viewer`), title and display name |
| `playbooks` | Player share links: title, which plays, on/off, view count. Players read them through the `get_playbook` function, which returns only those plays plus the team name and colors. |
| `items` | One row per drill, practice plan (id = date) or play (`kind` says which). The item itself is JSON in `data`. |

The app doesn't store any player information. If you add rosters or attendance later, remember that's data about minors: keep it to the minimum, write a privacy policy, and check your district's rules before collecting it.

**Upgrading from the first version?** Run `supabase/schema.sql` again in the SQL Editor. It adds roles, titles, view-only codes and player playbooks without touching your data.

## Ideas for later

- **Programs:** an athletic-department level above teams, with one shared drill library for every team in a school.
- **Sharing:** a public play library.
- **Sign-in:** Google sign-in (Supabase → Authentication → Providers → Google, plus one line in `boot.js`).
- **Billing:** subscriptions through Stripe, if you want to charge other coaches.

## Team tools (roster, gameplans, scouting reports, bus lists, game-day food sign-ups)

The Team tab needs one database update. In Supabase → SQL Editor → New query, paste
`supabase/team-tools.sql` and tap Run. It is safe to run more than once. Parents open the food
sign-up at `signup.html?s=<code>` without an account; it only shows first names and last initials,
never phone numbers or emails.

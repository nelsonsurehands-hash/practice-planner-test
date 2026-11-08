/* Cloudflare Worker: branded link previews for the links coaches send parents and players.
   theextracoach.com/c/<id> (calendar), /f/<id> (food sign-up), /p/<id> (playbook).
   Text messages, Facebook and email apps don't run the page's code, so without this every link
   previews as a generic "Team Schedule". The worker looks up the team and writes its name,
   logo and color into the page before it's sent, so the preview shows the team.
   /og/<kind>/<id> serves the team's logo as the preview picture.
   If anything goes wrong it falls back to the plain page, so links never break.
   Routes: theextracoach.com/c/*, theextracoach.com/f/*, theextracoach.com/p/*, theextracoach.com/og/* */
const SITE = "https://theextracoach.com";
const SUPA = "https://oxtylgrznthjbqreatio.supabase.co";
const KEY = "sb_publishable_UkEX5LFpoT_GuWpPtO1ybg_dt_IS-9D";   // public (publishable) key, same one the website uses
const KINDS = {
  c: { page: "/schedule.html", rpc: "get_calendar" },
  f: { page: "/signup.html", rpc: "get_signup" },
  p: { page: "/playbook.html", rpc: "get_playbook" }
};

async function lookup(kind, id) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 2500);
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/${KINDS[kind].rpc}`, {
      method: "POST", signal: ctl.signal,
      headers: { apikey: KEY, "content-type": "application/json" },
      body: JSON.stringify({ p_id: id }),
      cf: { cacheTtl: 0 }
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

const clean = s => String(s || "").replace(/\s+/g, " ").trim();
function teamName(t) {
  t = t || {};
  const sm = [t.school, t.mascot].map(clean).filter(Boolean).join(" ");
  return sm || clean(t.name) || "Team";
}
function texts(kind, d) {
  // Title = school + mascot + grade ("Hickory Hills Spartans 8th Grade"), so each grade's link reads as its own team
  const t = d.team || {}, many = Array.isArray(d.teams) && d.teams.length > 1;
  const base = [t.school, t.mascot].map(clean).filter(Boolean).join(" ") || clean(t.name) || "Team";
  const grade = many ? d.teams.map(x => clean((x.team || {}).teamLabel) || clean((x.team || {}).name)).join(" & ") : clean(t.teamLabel);
  const name = [base, grade].filter(Boolean).join(" ");
  if (kind === "c") return { title: `${name} Schedule`, desc: "Practices and games, always up to date. Tap to open. No account needed." };
  if (kind === "f") return { title: `${name} · ${clean(d.title) || "Game-Day Food Sign-Up"}`, desc: "Pick a game and what you'll bring. Tap to sign up. No account needed." };
  return { title: `${name} · ${clean(d.title) || "Playbook"}`, desc: "Watch every play step by step. Tap to open." };
}

async function logoResponse(kind, id) {
  const d = KINDS[kind] && /^[A-Za-z0-9]{4,40}$/.test(id) ? await lookup(kind, id) : null;
  const logo = d && d.team && d.team.logo;
  const m = typeof logo === "string" && logo.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/);
  if (m) {
    const bin = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
    return new Response(bin, { headers: { "content-type": m[1].replace("jpg", "jpeg"), "cache-control": "public, max-age=3600" } });
  }
  if (typeof logo === "string" && /^https:\/\//.test(logo)) return Response.redirect(logo, 302);
  return Response.redirect(SITE + "/icons/icon-512.png", 302);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const og = url.pathname.match(/^\/og\/([cfp])\/([A-Za-z0-9]+)/);
    if (og) { try { return await logoResponse(og[1], og[2]); } catch { return Response.redirect(SITE + "/icons/icon-512.png", 302); } }

    const m = url.pathname.match(/^\/([cfp])\/([A-Za-z0-9]{4,40})\/?$/);
    const kind = m && m[1];
    const pagePath = kind ? KINDS[kind].page : null;
    if (!pagePath) return fetch(request);

    // The page itself (same as the website serves at /schedule.html etc.)
    const page = await fetch(SITE + pagePath, { headers: { "cache-control": "no-cache" }, cf: { cacheTtl: 0 } });
    if (!page.ok) return page;
    const headers = new Headers(page.headers);
    headers.set("cache-control", "no-cache");
    headers.delete("content-length");

    let d = null;
    try { d = await lookup(kind, m[2]); } catch {}
    if (!d) return new Response(page.body, { status: 200, headers });

    const t = d.team || {}, x = texts(kind, d), color = /^#[0-9a-f]{6}$/i.test(t.color || "") ? t.color : null;
    // The team's own logo, never the app's. No logo: no picture, so the preview is the team name alone.
    const img = t.logo ? `${SITE}/og/${kind}/${m[2]}` : "";
    const site = [t.school, t.mascot].map(clean).filter(Boolean).join(" ") || clean(t.name) || "Team";
    const link = `${SITE}/${kind}/${m[2]}`;
    const set = (sel, val) => ({ element(el) { el.setAttribute("content", val); } });
    const rw = new HTMLRewriter()
      .on('meta[property="og:title"]', set(0, x.title))
      .on('meta[property="og:description"]', set(0, x.desc))
      .on('meta[name="description"]', set(0, x.desc))
      .on('meta[property="og:site_name"]', set(0, site))
      .on("title", { element(el) { el.setInnerContent(x.title); } })
      .on("head", { element(el) {
        const q = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        el.append(`<meta property="og:url" content="${link}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${q(x.title)}">` +
          (img ? `<meta property="og:image" content="${img}"><meta name="twitter:image" content="${img}"><link rel="apple-touch-icon" href="${img}">` : ""), { html: true });
      } });
    if (img) rw.on('link[rel="icon"]', { element(el) { el.setAttribute("href", img); } });
    if (color) rw.on('meta[name="theme-color"]', set(0, color));
    return rw.transform(new Response(page.body, { status: 200, headers }));
  }
};

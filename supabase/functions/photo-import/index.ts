// Coach Practice Planner: "Add from a photo".
// Reads a photo of a roster, a schedule or a play with Claude and returns the details for the
// coach to review in the app. The Anthropic key never leaves Supabase (secret ANTHROPIC_API_KEY).
//
// Checks on every request: the person is signed in, is on the team, and is allowed to edit that
// part of the app; and the team is under its monthly photo limit (PHOTO_LIMIT, default 150).
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("PHOTO_MODEL") || "claude-sonnet-5";
const LIMIT = parseInt(Deno.env.get("PHOTO_LIMIT") || "150", 10);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const str = { type: "string" };
const TOOLS: Record<string, { area: string; tool: Record<string, unknown>; prompt: (c: Record<string, unknown>) => string }> = {
  roster: {
    area: "schedule",
    tool: {
      name: "save_roster",
      description: "Every player readable in the photo(s), with parent or guardian contact details when shown.",
      input_schema: {
        type: "object",
        properties: {
          players: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { ...str, description: "Jersey number, digits only, or empty" },
                name: { ...str, description: "Player's first and last name" },
                pos: { ...str, description: "Grade and/or position if shown, e.g. '8th · Guard'" },
                parent: { ...str, description: "Parent or guardian name" },
                phone: { ...str, description: "Parent phone, formatted like 417-555-0101" },
                email: str, parent2: str, phone2: str,
                unsure: { type: "boolean", description: "true if any part of this row was hard to read" },
              },
              required: ["name"],
            },
          },
          notes: { ...str, description: "Anything the coach should double-check, in one or two short sentences" },
        },
        required: ["players"],
      },
    },
    prompt: () =>
      "This is a photo of a team roster (printed, handwritten, a sign-up sheet or a screenshot). " +
      "List every player. Keep names exactly as written; don't invent details that aren't there. " +
      "If a row is hard to read, include your best reading and set unsure to true.",
  },
  schedule: {
    area: "schedule",
    tool: {
      name: "save_schedule",
      description: "Games and special days (no school, holidays, breaks, tryouts, meetings) from the photo(s).",
      input_schema: {
        type: "object",
        properties: {
          games: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { ...str, description: "YYYY-MM-DD" },
                time: { ...str, description: "24-hour HH:MM start time, or empty if not shown" },
                opponent: str,
                home: { type: "string", enum: ["home", "away", "unknown"] },
                level: { ...str, description: "Team or level this game is for if the schedule lists several (e.g. '7th', '8th', 'JV'), else empty" },
                note: { ...str, description: "Location or anything else shown, e.g. 'Tournament', 'at Joplin North'" },
              },
              required: ["date", "opponent", "home"],
            },
          },
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { ...str, description: "YYYY-MM-DD (first day)" },
                end: { ...str, description: "YYYY-MM-DD last day for a multi-day break, or empty" },
                type: { type: "string", enum: ["noschool", "holiday", "nopractice", "tryout", "meeting", "extra", "other"] },
                label: { ...str, description: "Short name as written, e.g. 'Thanksgiving Break', 'Parent meeting'" },
              },
              required: ["date", "type"],
            },
          },
          notes: str,
        },
        required: ["games", "days"],
      },
    },
    prompt: (c) =>
      `This is a photo of a sports or school schedule. Today is ${c.today}. The team's season runs ${c.seasonStart || "?"} to ${c.seasonEnd || "?"}; ` +
      `use it to choose the year when the schedule shows only month and day. The coach's team is "${c.team || ""}". ` +
      "List every game (date, opponent, time, home or away: 'vs', 'home' or a home gym is home; '@', 'at' or 'away' is away). " +
      "If the schedule covers several teams or levels, include every game and fill in level. " +
      "Also list special days shown: no school, holidays and breaks (use end for ranges), no practice, tryouts, meetings, extra practices. " +
      "Use 24-hour times. Don't invent games that aren't on the page.",
  },
  play: {
    area: "plays",
    tool: {
      name: "draw_play",
      description: "The play in the photo, converted to the planner's court coordinates, step by step.",
      input_schema: {
        type: "object",
        properties: {
          name: { ...str, description: "Play name if written, else a short descriptive name" },
          type: str,
          notes: { ...str, description: "Any written notes, reads or coaching points" },
          offense: { type: "array", items: { type: "object", properties: { n: { type: "integer" }, x: { type: "number" }, y: { type: "number" }, label: str }, required: ["n", "x", "y"] } },
          defense: { type: "array", items: { type: "object", properties: { n: { type: "integer" }, x: { type: "number" }, y: { type: "number" } }, required: ["n", "x", "y"] } },
          ball: { type: "integer", description: "Offensive player number who starts with the ball" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                caption: { ...str, description: "What happens in this step, e.g. '1 passes to 2, 5 screens for 3'" },
                moves: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      who: { ...str, description: "'o3' for offensive player 3, 'd2' for defender 2" },
                      type: { type: "string", enum: ["cut", "dribble", "screen"] },
                      x: { type: "number" }, y: { type: "number" },
                    },
                    required: ["who", "type", "x", "y"],
                  },
                },
                passes: { type: "array", description: "In order", items: { type: "object", properties: { from: { type: "integer" }, to: { type: "integer" } }, required: ["from", "to"] } },
                shot: { type: "boolean", description: "Whoever has the ball shoots at the end of this step" },
              },
              required: ["caption"],
            },
          },
          unsure: { ...str, description: "Anything you had to guess" },
        },
        required: ["name", "offense", "steps"],
      },
    },
    prompt: (c) =>
      `This is a photo of a ${c.sport || "basketball"} play diagram (whiteboard, notebook or printout). Convert it to the planner's board. ` +
      (c.sport && c.sport !== "basketball" ? `The field box runs x 0 to 500 and y 0 to 470. ` :
        "Coordinates: half court, x 0 (left sideline) to 500 (right sideline), y 0 at the baseline (top) to 470 at half court. " +
        "Basket at (250, 52). Lane x 170 to 330 from the baseline to the free-throw line at y 190. Free-throw circle center (250, 190) radius 60. " +
        "3-point line: straight in the corners at x 52 and 448 down to y 52, then an arc of radius 198 around the basket (top of the key about y 250). " +
        "Typical spots: point (250, 330), wings (75, 245) and (425, 245), corners (45, 55) and (455, 55), blocks (165, 95) and (335, 95), elbows (170, 190) and (330, 190). ") +
      "If the drawing has the basket at the bottom, flip it so the basket is at the top. " +
      `Numbers 1 to ${c.players || 5} are offensive players; X's are defenders. Lines: plain arrow = cut, zig-zag = dribble, dashed = pass, line ending in a bar = screen. ` +
      "Break the play into steps in the order things happen; everything in one step happens at the same time, and players start each step where they ended the last one. " +
      (Number(c.photos) > 1 ? `There are ${c.photos} photos of this ONE play, in order: photo 1 is the start and each later photo shows what happens next. ` +
        "Combine them into a single play: take the starting positions from photo 1, make at least one step for each photo in order, and use later photos to see where players ended up. " +
        "Don't repeat a movement that was already drawn in an earlier photo. " : "") +
      `Play types to choose from: ${(c.types as string[] || []).join(", ")}.`,
  },
};

Deno.serve(async (req) => {
  try { return await handle(req); }
  catch (e) { console.error(e); return reply(500, { error: "The photo reader hit a problem on the server. Try again in a minute." }); }
});
async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });
  // A key pasted into Supabase can pick up spaces, line breaks, "smart quotes" or even its own name
  // ("ANTHROPIC_API_KEY=sk-ant-…"): pull the key itself out of whatever was pasted.
  const raw = Deno.env.get("ANTHROPIC_API_KEY") || "";
  const key = (raw.match(/sk-ant-[A-Za-z0-9_-]{20,}/) || [""])[0];
  if (!raw.trim()) return reply(500, { error: "The photo reader isn't set up: add the ANTHROPIC_API_KEY secret in Supabase." });
  if (!key) return reply(500, { error: "The photo reader's key in Supabase doesn't look like an Anthropic API key. In Supabase → Edge Functions → Secrets, replace ANTHROPIC_API_KEY with a key from console.anthropic.com → API keys (it starts with sk-ant-)." });

  let body: { kind?: string; team?: string; images?: { data: string; type: string }[]; context?: Record<string, unknown> };
  try { body = await req.json(); } catch { return reply(400, { error: "Bad request." }); }
  const spec = TOOLS[body.kind || ""];
  if (!spec || !body.team) return reply(400, { error: "Bad request." });
  const images = (body.images || []).slice(0, 6).filter((i) => i && i.data && /^image\/(jpeg|png|webp|gif)$/.test(i.type));
  if (!images.length) return reply(400, { error: "Add a photo first." });

  // Who's asking, and may they change this part of the team?
  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY"))!, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return reply(401, { error: "Sign in again, then try the photo again." });
  const { data: allowed, error: permErr } = await asUser.rpc("can_edit", { t: body.team, area: spec.area });
  if (permErr || !allowed) return reply(403, { error: "You don't have permission to change this for the team." });

  // Monthly limit per team.
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { data: rows } = await admin.from("ai_usage").select("photos").eq("team_id", body.team).gte("created_at", monthStart.toISOString());
  const used = (rows || []).reduce((n: number, r: { photos: number }) => n + (r.photos || 1), 0);
  if (used + images.length > LIMIT) return reply(429, { error: `Your team has used its ${LIMIT} photos for this month. It resets on the 1st.`, used, limit: LIMIT });

  const res = await fetch((Deno.env.get("ANTHROPIC_BASE_URL") || "https://api.anthropic.com") + "/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      tools: [spec.tool],
      tool_choice: { type: "tool", name: (spec.tool as { name: string }).name },
      messages: [{
        role: "user",
        content: [
          ...images.flatMap((i, k) => [
            ...(images.length > 1 ? [{ type: "text", text: `Photo ${k + 1} of ${images.length}:` }] : []),
            { type: "image", source: { type: "base64", media_type: i.type, data: i.data } },
          ]),
          { type: "text", text: spec.prompt(body.context || {}) },
        ],
      }],
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = (out && out.error && out.error.message) || `HTTP ${res.status}`;
    const friendly = res.status === 401 ? "The Anthropic API key in Supabase isn't valid. Make a new key and update the secret." :
      /credit|billing|balance/i.test(m) ? "The Anthropic account is out of credits or has hit its spend limit." :
      res.status === 429 || res.status === 529 ? "Claude is busy right now. Try again in a minute." : "Claude couldn't read the photo: " + m;
    return reply(502, { error: friendly });
  }
  const use = (out.content || []).find((b: { type: string }) => b.type === "tool_use");
  if (!use) return reply(502, { error: "Claude couldn't read anything useful from that photo. Try a clearer, closer picture." });

  await admin.from("ai_usage").insert({ team_id: body.team, user_id: user.id, kind: body.kind, photos: images.length });
  return reply(200, { result: use.input, used: used + images.length, limit: LIMIT });
}

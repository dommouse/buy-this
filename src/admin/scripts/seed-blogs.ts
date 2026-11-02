/**
 * Seed 4 published blog posts authored by the super-admin.
 * Usage: npm run admin:seed-blogs
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) loadEnv({ path: envPath });

type BlogSeed = {
  title: string;
  slug: string;
  excerpt: string;
  cover_url: string;
  sort_order: number;
  seo_title: string;
  seo_description: string;
  content_html: string;
};

const POSTS: BlogSeed[] = [
  {
    title: "How to Pick a Gift They'll Actually Use",
    slug: "how-to-pick-a-gift-theyll-actually-use",
    excerpt:
      "Stop guessing. Use occasion, personality, and budget as a simple filter so every gift feels intentional — not random.",
    cover_url:
      "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=1400&q=80",
    sort_order: 0,
    seo_title: "How to Pick a Gift They'll Actually Use | BUY THIS",
    seo_description:
      "A practical framework for choosing gifts based on the person, the moment, and your budget — without the panic.",
    content_html: `
<p>Most gift stress comes from starting with products instead of people. Flip that: start with <strong>who they are</strong>, then narrow to what fits the moment and your budget.</p>
<h2>1. Name the relationship and the occasion</h2>
<p>A birthday for your partner is not the same as a housewarming for a coworker. Write one sentence: <em>“This is for [person] because of [occasion].”</em> That sentence quietly rules out half of the bad ideas.</p>
<img src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1200&q=80" alt="Wrapped gifts on a table" style="width:100%;border-radius:12px;margin:1.25rem 0;" />
<h2>2. Capture three real signals</h2>
<ul>
  <li><strong>How they spend free time</strong> — cooking, hiking, gaming, home projects</li>
  <li><strong>What they already own too much of</strong> — candles, mugs, novelty socks</li>
  <li><strong>What would make a Tuesday easier</strong> — comfort, convenience, or a small luxury</li>
</ul>
<p>If you can answer those three, you’re already ahead of most gift guides.</p>
<h2>3. Match budget to “feel,” not price alone</h2>
<p>A $35 gift that solves a daily annoyance often beats a $150 item that sits in a drawer. Ask: will they <em>use</em> it, <em>wear</em> it, or <em>do</em> something with it?</p>
<h2>4. Prefer one strong idea over five weak ones</h2>
<p>Great gifting is editing. Pick one clear story: “helping them host,” “supporting a new hobby,” “making mornings calmer.” Then buy the best version of that story you can afford.</p>
<p>That’s the same approach behind <strong>Find A Gift</strong> — a short questionnaire that turns those signals into a focused shortlist, so you’re not scrolling forever.</p>
`.trim(),
  },
  {
    title: "Birthday Gifts by Personality (Not Age Alone)",
    slug: "birthday-gifts-by-personality",
    excerpt:
      "Age ranges help, but personality is what makes a birthday feel personal. Here’s how to match gifts to how someone actually lives.",
    cover_url:
      "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1400&q=80",
    sort_order: 1,
    seo_title: "Birthday Gifts by Personality | BUY THIS",
    seo_description:
      "Match birthday gifts to personality types — the planner, the adventurer, the homebody, and the creative — with clear examples.",
    content_html: `
<p>Age tells you size and stage. Personality tells you what will make them smile when they open the box.</p>
<img src="https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80" alt="Colorful birthday celebration" style="width:100%;border-radius:12px;margin:1.25rem 0;" />
<h2>The planner</h2>
<p>They love systems, calendars, and “finally organized.” Think quality desk tools, a beautiful notebook system, noise-cancelling headphones for deep work, or a membership that saves them time (meal kit, laundry pickup, museum pass).</p>
<h2>The adventurer</h2>
<p>Experiences and gear beat décor. Day-trip vouchers, trail-ready accessories, a portable speaker, or a cooking class they wouldn’t book for themselves.</p>
<h2>The homebody</h2>
<p>Upgrade something they already do daily: better coffee, softer bedding, a cozy throw that isn’t another candle set, or a kitchen tool that makes weeknights easier.</p>
<img src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80" alt="Friends celebrating together" style="width:100%;border-radius:12px;margin:1.25rem 0;" />
<h2>The creative</h2>
<p>Give materials and permission: art supplies a step above what they buy themselves, a workshop, vinyl for a new obsession, or a framed print that matches their taste — not yours.</p>
<h2>Quick rule</h2>
<p>If you can’t describe why the gift fits <em>them</em> in one sentence, keep looking. Personality-first birthdays feel thoughtful even when the budget is modest.</p>
`.trim(),
  },
  {
    title: "Last-Minute Gifts That Still Feel Thoughtful",
    slug: "last-minute-gifts-that-still-feel-thoughtful",
    excerpt:
      "Same-day shipping anxiety? These gift strategies look intentional even when you only have hours — not weeks.",
    cover_url:
      "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=1400&q=80",
    sort_order: 2,
    seo_title: "Last-Minute Gifts That Still Feel Thoughtful | BUY THIS",
    seo_description:
      "Practical last-minute gift ideas and wrapping strategies that still feel personal when time is short.",
    content_html: `
<p>Last-minute doesn’t have to mean low-effort. The trick is choosing gifts with a clear “I know you” signal — and skipping anything that screams “gas station aisle.”</p>
<img src="https://images.unsplash.com/photo-1513201099705-a9746d9c498a?auto=format&fit=crop&w=1200&q=80" alt="Shopping bags and gifts" style="width:100%;border-radius:12px;margin:1.25rem 0;" />
<h2>Choose “useful luxury” over novelty</h2>
<p>Upgrade a daily ritual: better coffee beans + a small pour-over set, a favorite snack box, quality hand cream with a handwritten note, or a book you’ve actually read and can recommend in two sentences.</p>
<h2>Digital + physical hybrid</h2>
<p>Buy something that arrives later (or digitally) and present a card now: concert tickets, a cooking class, a hotel night, a streaming or magazine subscription. The anticipation becomes part of the gift.</p>
<h2>Presentation saves the day</h2>
<ul>
  <li>Write a specific note (“For Sunday mornings when you need quiet”)</li>
  <li>Use real wrapping or a simple kraft bag with ribbon</li>
  <li>Remove price tags and cluttered packaging inserts</li>
</ul>
<img src="https://images.unsplash.com/photo-1481391319762-47dff72954d9?auto=format&fit=crop&w=1200&q=80" alt="Gift with ribbon" style="width:100%;border-radius:12px;margin:1.25rem 0;" />
<h2>What to avoid</h2>
<p>Generic gift cards with no context, gag gifts that punch down, and anything they explicitly asked you not to buy. When time is short, clarity beats cleverness.</p>
<p>If you’re stuck, run through <strong>Find A Gift</strong> — even a five-minute answer set beats panic-scrolling Amazon for an hour.</p>
`.trim(),
  },
  {
    title: "Gifting for Couples, Parents, and Friends Without Awkwardness",
    slug: "gifting-for-couples-parents-and-friends",
    excerpt:
      "Different relationships need different tones. Here’s how to gift across couples, parents, and friends without overthinking the etiquette.",
    cover_url:
      "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1400&q=80",
    sort_order: 3,
    seo_title: "Gifting for Couples, Parents & Friends | BUY THIS",
    seo_description:
      "Relationship-aware gift ideas for couples, parents, and friends — with etiquette tips that keep things warm, not weird.",
    content_html: `
<p>The same object can feel romantic, parental, or purely platonic depending on packaging and context. Match the <em>tone</em> to the relationship.</p>
<img src="https://images.unsplash.com/photo-1529634597503-139d3726dea3?auto=format&fit=crop&w=1200&q=80" alt="Couple sharing a moment" style="width:100%;border-radius:12px;margin:1.25rem 0;" />
<h2>For couples (partners)</h2>
<p>Lead with shared memory or future plans: a picnic kit for your favorite park, a framed photo from a trip, a cooking night with ingredients included, or something that upgrades a ritual you already share. Avoid gifts that imply a “fix” unless that conversation is already open.</p>
<h2>For parents</h2>
<p>Parents often put themselves last. Gifts that reclaim time or comfort land well: a massage voucher, better sleep gear, a quiet hobby restart, or a family photo book they didn’t have to assemble. Include a note that doesn’t ask them to “do more.”</p>
<img src="https://images.unsplash.com/photo-1609220136736-443140cffec6?auto=format&fit=crop&w=1200&q=80" alt="Family together at home" style="width:100%;border-radius:12px;margin:1.25rem 0;" />
<h2>For friends</h2>
<p>Inside jokes and shared interests win. Concert merch from a band you saw together, a board game for game night, a plant with a silly name, or a care package for a tough month. Keep the price roughly in the same ballpark as what they usually spend on you — reciprocity matters more among friends than people admit.</p>
<h2>Etiquette in one line</h2>
<p>If you’d feel weird explaining the gift out loud to a mutual friend, soften the gift or the message. Warm and clear beats mysterious and intense.</p>
`.trim(),
  },
];

async function main() {
  const url = process.env["VITE_DB_URL"] || process.env["SUPABASE_URL"] || "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  const bootstrapEmail = (process.env["ADMIN_BOOTSTRAP_EMAIL"] || "").trim().toLowerCase();

  if (!url || !key) throw new Error("Set VITE_DB_URL and SUPABASE_SERVICE_ROLE_KEY in .env");

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let authorId: string | null = null;
  let authorLabel = "";

  if (bootstrapEmail) {
    const { data } = await db
      .from("admin_users")
      .select("id, name, email, role")
      .eq("email", bootstrapEmail)
      .maybeSingle();
    if (data) {
      authorId = data.id;
      authorLabel = `${data.name} <${data.email}>`;
    }
  }

  if (!authorId) {
    const { data } = await db
      .from("admin_users")
      .select("id, name, email, role")
      .eq("role", "super")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) {
      authorId = data.id;
      authorLabel = `${data.name} <${data.email}>`;
    }
  }

  if (!authorId) {
    throw new Error("No super-admin found. Run npm run admin:seed first.");
  }

  console.log(`Authoring blogs as ${authorLabel}`);

  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;

  for (const post of POSTS) {
    const payload = {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content_html: post.content_html,
      cover_url: post.cover_url,
      author_admin_id: authorId,
      status: "published" as const,
      sort_order: post.sort_order,
      seo_title: post.seo_title,
      seo_description: post.seo_description,
      published_at: now,
      updated_at: now,
    };

    const { data: existing } = await db.from("blogs").select("id").eq("slug", post.slug).maybeSingle();
    if (existing) {
      const { error } = await db.from("blogs").update(payload).eq("id", existing.id);
      if (error) throw new Error(`${post.slug}: ${error.message}`);
      updated += 1;
      console.log(`Updated: ${post.slug}`);
    } else {
      const { error } = await db.from("blogs").insert(payload);
      if (error) throw new Error(`${post.slug}: ${error.message}`);
      created += 1;
      console.log(`Created: ${post.slug}`);
    }
  }

  console.log(`Done. Created ${created}, updated ${updated}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

// Roles, departments and the work each role can log.

export const DOMAIN = "nakshatranamahacreations.com";

export const ROLES = {
  seo:  { l: "SEO analyst",       dept: "Digital Marketing",  c: "#0891B2", pick: "clients",  page: ["ranks", "Keyword positions"] },
  seox: { l: "SEO expert",        dept: "Digital Marketing",  c: "#0E7490", pick: "clients",  page: ["ranks", "Keyword positions"] },
  ads:  { l: "Google Ads expert", dept: "Digital Marketing",  c: "#D97706", pick: "clients",  page: ["ads", "Daily ads report"] },
  gfx:  { l: "Graphic designer",  dept: "Design",             c: "#DB2777", pick: "clients",  page: ["designs", "My designs"] },
  vid:  { l: "Video editor",      dept: "Design",             c: "#9333EA", pick: "clients",  page: ["designs", "My designs"] },
  app:  { l: "App developer",     dept: "Development",        c: "#2563EB", pick: "projects", page: ["bugs", "My bugs"] },
  web:  { l: "Website developer", dept: "Development",        c: "#0D9488", pick: "projects", page: ["bugs", "My bugs"] },
  back: { l: "Backend developer", dept: "Development",        c: "#4F46E5", pick: "projects", page: ["bugs", "My bugs"] },
  full: { l: "Full stack developer", dept: "Development",     c: "#0369A1", pick: "projects", page: ["bugs", "My bugs"] },
  ux:   { l: "UI/UX designer",    dept: "Design",             c: "#DB2777", pick: "projects", page: ["designs", "My designs"] },
  test: { l: "Tester",            dept: "Testing",            c: "#7C3AED", pick: "projects", page: ["bugs", "Bugs"] },
  other: { l: "Team member",      dept: "Development",        c: "#64748B", pick: "projects", page: ["bugs", "My bugs"] },
  acc:  { l: "Accountant",        dept: "Accounts",           c: "#475569", pick: null,       page: ["payments", "Projects and payments"] },
};

const DEV = ["app", "back", "web", "full", "other"];
const DM = ["seo", "seox", "ads"];   // the whole digital marketing team
const ALL = Object.keys(ROLES);

// The groups the work types are shown in on Log work
export const GROUPS = [
  ["seo", "SEO and content"], ["gads", "Google Ads"], ["meta", "Meta Ads and social media"], ["rep", "Reports and tracking"],
  ["dev", "Development"], ["design", "Design"], ["video", "Video editing"], ["test", "Testing"], ["acc", "Accounts"], ["gen", "Meetings and other work"],
];

// c: true = logged against a client (SEO side); otherwise against a project. g: the group it is shown in.
export const TY = {
  // SEO and content
  webcontent:  { g: "seo", l: "Website content",       h: "Pages or sections written for a site",       r: DM, c: true },
  blogcontent: { g: "seo", l: "Blog content written",  h: "Draft written, before it goes live",         r: DM, c: true },
  blog:        { g: "seo", l: "Blog published",        h: "Link to the live blog",                      r: DM, c: true },
  landing:     { g: "seo", l: "Landing page content",  h: "Copy for an ad or offer page",               r: DM, c: true },
  backlink:    { g: "seo", l: "Backlinks",             h: "Paste one or more live links",               r: DM, c: true },
  gmb:         { g: "seo", l: "GMB post",              h: "Google Business Profile post",               r: DM, c: true },
  onpage:      { g: "seo", l: "On-page SEO",           h: "Meta tags, schema, speed, content",          r: DM, c: true },
  kwresearch:  { g: "seo", l: "Keyword research",      h: "Keywords found for a client, page or ad",    r: DM, c: true },
  // Google Ads
  campaign:    { g: "gads", l: "Campaign setup",       h: "New Search, PMax, Display or YouTube campaign", r: DM, c: true },
  optimise:    { g: "gads", l: "Campaign or ad changes", h: "Bids, budget, ads, targeting",             r: DM, c: true },
  tracking:    { g: "gads", l: "GSC / GA4 / GTM setup", h: "Search Console, Analytics or Tag Manager set up", r: DM, c: true },
  newad:       { g: "gads", l: "New ad or campaign",   h: "Ad copy, ad group or extensions",            r: DM, c: true, hide: true },
  negative:    { g: "gads", l: "Negative keywords",    h: "Terms blocked to stop wasted spend",         r: DM, c: true },
  // Meta Ads and social media
  metaads:     { g: "meta", l: "Meta Ads",             h: "Facebook and Instagram campaign set up or changed", r: DM, c: true },
  social:      { g: "meta", l: "Social media posts",   h: "Posts created, scheduled or published",      r: [...DM, "gfx", "vid"], c: true },
  // Reports and tracking
  position:    { g: "rep", l: "Position tracking",     h: "Keyword ranks checked and recorded",         r: DM, c: true },
  monthly:     { g: "rep", l: "Monthly report",        h: "The client's report for the month",          r: DM, c: true },
  docs:        { g: "rep", l: "Documentation or reporting", h: "Documents, sheets or reports",          r: ALL },
  // Development
  feature:  { g: "dev", l: "Feature or module",   h: "Commit or pull request link",              r: DEV },
  page:     { g: "dev", l: "Page built",          h: "Staging page link",                        r: ["web", "full"] },
  build:    { g: "dev", l: "App build",           h: "APK or TestFlight link",                   r: ["app"] },
  deploy:   { g: "dev", l: "Deployment",          h: "Staging or live link",                     r: ["web", "back", "full"] },
  bugfix:   { g: "dev", l: "Bug fixed",           h: "Commit link for the fix",                  r: DEV },
  // Design
  screen:   { g: "design", l: "Screens designed",    h: "Figma link",                               r: ["ux"] },
  revision: { g: "design", l: "Design revision",     h: "Changes the client asked for",             r: ["ux"] },
  logo:     { g: "design", l: "Logo design",         h: "Concepts, revisions or final files",       r: ["gfx"], c: true },
  vcard:    { g: "design", l: "Visiting card",       h: "Business card design",                     r: ["gfx"], c: true },
  brochure: { g: "design", l: "Brochure design",     h: "Print or digital brochure",                r: ["gfx"], c: true },
  poster:   { g: "design", l: "Poster design",       h: "Social, GMB or print poster",              r: ["gfx", "ux"], c: true },
  // Video editing
  corpvideo:  { g: "video", l: "Corporate video",    h: "Company, office or event video edited",    r: ["vid"], c: true },
  instavideo: { g: "video", l: "Instagram ad video", h: "Reel, story or ad video edited",           r: ["vid"], c: true },
  motion:     { g: "video", l: "Motion graphics or explainer video", h: "Animated or explainer video", r: ["vid"], c: true },
  // Testing
  test:     { g: "test", l: "Test run",            h: "Cases passed and failed",                  r: ["test"] },
  bug:      { g: "test", l: "Raise a bug",         h: "Assign it to a developer",                 r: ["test"] },
  // Accounts
  invoice:  { g: "acc", l: "Invoice or payment",  h: "Invoice sent or payment received",         r: ["acc"] },
  // Meetings and other work
  meeting:  { g: "gen", l: "Meeting notes and MOM", h: "Notes, photos, minutes to send",         r: ALL, go: "/meetings" },
  other:    { g: "gen", l: "Other work",          h: "Anything else you worked on",              r: ALL },
};

// Work types for one role or for all of a person's roles
export const typesFor = (role) => { const R = Array.isArray(role) ? role : [role]; return Object.entries(TY).filter(([, t]) => !t.hide && t.r.some(x => R.includes(x))); };

// Every role a person has (main role first, then the extra roles the admin gave them)
export const rolesOf = (u) => [...new Set([u?.role, ...(u?.roles || [])].filter(r => ROLES[r]))];
export const hasRole = (u, list) => rolesOf(u).some(r => list.includes(r));

// One view of all of someone's roles: names, departments, the pages they get and what they work on
export function roleInfo(u) {
  const R = rolesOf(u), main = ROLES[R[0]] || ROLES.other;
  const pages = [];
  R.forEach(r => { const p = ROLES[r].page; if (!pages.some(x => x[0] === p[0])) pages.push(p); });
  const picks = new Set(R.map(r => ROLES[r].pick).filter(Boolean));
  return {
    roles: R, c: main.c,
    l: R.map(r => ROLES[r].l).join(" · "),
    dept: [...new Set(R.map(r => ROLES[r].dept))].join(" · "),
    pages, page: pages[0] || main.page,
    picks, pick: picks.has("projects") ? "projects" : picks.has("clients") ? "clients" : null,
  };
}

export const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).map(x => x[0]).join("").slice(0, 2).toUpperCase();

// One line describing the extra details logged with a piece of work
export function metaTxt(e) {
  const m = e.meta || {}, out = [];
  if (m.kw) out.push(`keyword: ${m.kw}`); if (m.da) out.push(`DA ${m.da}`); if (m.words) out.push(`${m.words} words`);
  if (m.camp) out.push(m.camp); if (m.platform) out.push(m.platform); if (m.screens) out.push(`${m.screens} screen${m.screens > 1 ? "s" : ""}`);
  if (m.ver) out.push(`v${m.ver}`); if (m.pass != null) out.push(`${m.pass} passed, ${m.fail} failed`);
  if (m.bug) out.push(`${m.bug}${m.sev ? ` · ${m.sev}` : ""}${m.assignName ? ` · to ${m.assignName}` : ""}`);
  if (m.amt) out.push(`₹${(+m.amt).toLocaleString("en-IN")}`); if (m.mod) out.push(m.mod); if (m.terms) out.push(m.terms);
  if (m.pages) out.push(`${m.pages} page${m.pages > 1 ? "s" : ""}`); if (m.posts) out.push(`${m.posts} post${m.posts > 1 ? "s" : ""}`);
  if (m.kws) out.push(`${m.kws} keywords`); if (m.month) out.push(m.month);
  if (m.tools) out.push(m.tools);
  if (m.kind) out.push(m.kind); if (m.len) out.push(`${m.len} sec`); if (m.qty) out.push(`${m.qty} design${m.qty > 1 ? "s" : ""}`);
  if (m.files?.length) out.push(`${m.files.length} attachment${m.files.length > 1 ? "s" : ""}`);
  return out.join(" · ");
}

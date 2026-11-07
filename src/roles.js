// Roles, departments and the work each role can log.

export const DOMAIN = "nakshatranamahacreations.com";

export const ROLES = {
  seo:  { l: "SEO analyst",       dept: "Digital Marketing",  c: "#0891B2", pick: "clients",  page: ["ranks", "Keyword positions"] },
  seox: { l: "SEO expert",        dept: "Digital Marketing",  c: "#0E7490", pick: "clients",  page: ["ranks", "Keyword positions"] },
  ads:  { l: "Google Ads expert", dept: "Digital Marketing",  c: "#D97706", pick: "clients",  page: ["ads", "Daily ads report"] },
  gfx:  { l: "Graphic designer",  dept: "Design",             c: "#DB2777", pick: "clients",  page: ["designs", "My designs"] },
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
const SEO = ["seo", "seox"];
const DM = ["seo", "seox", "ads"];   // the whole digital marketing team
const ALL = Object.keys(ROLES);

// c: true = logged against a client (SEO side); otherwise against a project
export const TY = {
  backlink: { l: "Backlinks",           h: "Paste one or more live links",             r: SEO, c: true },
  blog:     { l: "Blog published",      h: "Link to the live blog",                    r: SEO, c: true },
  gmb:      { l: "GMB post",            h: "Google Business Profile post",             r: SEO, c: true },
  onpage:   { l: "On-page SEO",         h: "Meta tags, schema, speed, content",        r: SEO, c: true },
  webcontent:  { l: "Website content",       h: "Pages or sections written for a site",     r: SEO, c: true },
  blogcontent: { l: "Blog content written",  h: "Draft written, before it is published",    r: SEO, c: true },
  landing:     { l: "Landing page content",  h: "Copy for an ad or offer page",             r: DM, c: true },
  campaign:    { l: "Campaign setup",        h: "New Google, Meta or other campaign",       r: DM, c: true },
  social:      { l: "Social media posts scheduled", h: "Posts lined up on a planner",       r: [...DM, "gfx"], c: true },
  position:    { l: "Position tracking",     h: "Keyword ranks checked and recorded",       r: SEO, c: true },
  monthly:     { l: "Monthly report",        h: "The client's report for the month",        r: DM, c: true },
  docs:        { l: "Documentation or reporting", h: "Documents, sheets or reports",        r: ALL },
  optimise: { l: "Campaign change",     h: "Bids, budget, ads, targeting",             r: ["ads"], c: true },
  negative: { l: "Negative keywords",   h: "Terms blocked to stop wasted spend",       r: ["ads"], c: true },
  newad:    { l: "New ad or campaign",  h: "Ad copy, ad group or campaign",            r: ["ads"], c: true },
  feature:  { l: "Feature or module",   h: "Commit or pull request link",              r: DEV },
  page:     { l: "Page built",          h: "Staging page link",                        r: ["web", "full"] },
  build:    { l: "App build",           h: "APK or TestFlight link",                   r: ["app"] },
  deploy:   { l: "Deployment",          h: "Staging or live link",                     r: ["web", "back", "full"] },
  bugfix:   { l: "Bug fixed",           h: "Commit link for the fix",                  r: DEV },
  screen:   { l: "Screens designed",    h: "Figma link",                               r: ["ux"] },
  revision: { l: "Design revision",     h: "Changes the client asked for",             r: ["ux"] },
  poster:   { l: "Poster or creative",  h: "For SEO and social clients",               r: ["gfx", "ux"], c: true },
  test:     { l: "Test run",            h: "Cases passed and failed",                  r: ["test"] },
  bug:      { l: "Raise a bug",         h: "Assign it to a developer",                 r: ["test"] },
  invoice:  { l: "Invoice or payment",  h: "Invoice sent or payment received",         r: ["acc"] },
  meeting:  { l: "Meeting notes and MOM", h: "Notes, photos, minutes to send",         r: ALL, go: "/meetings" },
  other:    { l: "Other work",          h: "Anything else you worked on",              r: ALL },
};

// Work types for one role or for all of a person's roles
export const typesFor = (role) => { const R = Array.isArray(role) ? role : [role]; return Object.entries(TY).filter(([, t]) => t.r.some(x => R.includes(x))); };

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
  return out.join(" · ");
}

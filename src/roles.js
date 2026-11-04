// Roles, departments and the work each role can log.

export const DOMAIN = "nakshatranamahacreations.com";

export const ROLES = {
  seo:  { l: "SEO analyst",       dept: "SEO and Google Ads", c: "#0891B2", pick: "clients",  page: ["ranks", "Keyword positions"] },
  ads:  { l: "Google Ads expert", dept: "SEO and Google Ads", c: "#D97706", pick: "clients",  page: ["ads", "Daily ads report"] },
  gfx:  { l: "Graphic designer",  dept: "SEO and Google Ads", c: "#DB2777", pick: "clients",  page: ["designs", "My designs"] },
  app:  { l: "App developer",     dept: "Development",        c: "#2563EB", pick: "projects", page: ["bugs", "My bugs"] },
  web:  { l: "Website developer", dept: "Development",        c: "#0D9488", pick: "projects", page: ["bugs", "My bugs"] },
  back: { l: "Backend developer", dept: "Development",        c: "#4F46E5", pick: "projects", page: ["bugs", "My bugs"] },
  full: { l: "Full stack developer", dept: "Development",     c: "#0369A1", pick: "projects", page: ["bugs", "My bugs"] },
  ux:   { l: "UI/UX designer",    dept: "Design",             c: "#DB2777", pick: "projects", page: ["designs", "My designs"] },
  test: { l: "Tester",            dept: "Testing",            c: "#7C3AED", pick: "projects", page: ["bugs", "Bugs"] },
  acc:  { l: "Accountant",        dept: "Accounts",           c: "#475569", pick: null,       page: ["payments", "Projects and payments"] },
};

const DEV = ["app", "back", "web", "full"];
const ALL = Object.keys(ROLES);

// c: true = logged against a client (SEO side); otherwise against a project
export const TY = {
  backlink: { l: "Backlinks",           h: "Paste one or more live links",             r: ["seo"], c: true },
  blog:     { l: "Blog published",      h: "Link to the live blog",                    r: ["seo"], c: true },
  gmb:      { l: "GMB post",            h: "Google Business Profile post",             r: ["seo"], c: true },
  onpage:   { l: "On-page SEO",         h: "Meta tags, schema, speed, content",        r: ["seo"], c: true },
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

export const typesFor = (role) => Object.entries(TY).filter(([, t]) => t.r.includes(role));

export const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).map(x => x[0]).join("").slice(0, 2).toUpperCase();

// One line describing the extra details logged with a piece of work
export function metaTxt(e) {
  const m = e.meta || {}, out = [];
  if (m.kw) out.push(`keyword: ${m.kw}`); if (m.da) out.push(`DA ${m.da}`); if (m.words) out.push(`${m.words} words`);
  if (m.camp) out.push(m.camp); if (m.platform) out.push(m.platform); if (m.screens) out.push(`${m.screens} screen${m.screens > 1 ? "s" : ""}`);
  if (m.ver) out.push(`v${m.ver}`); if (m.pass != null) out.push(`${m.pass} passed, ${m.fail} failed`);
  if (m.bug) out.push(`${m.bug}${m.sev ? ` · ${m.sev}` : ""}${m.assignName ? ` · to ${m.assignName}` : ""}`);
  if (m.amt) out.push(`₹${(+m.amt).toLocaleString("en-IN")}`); if (m.mod) out.push(m.mod); if (m.terms) out.push(m.terms);
  return out.join(" · ");
}

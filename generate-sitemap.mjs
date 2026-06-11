import fs from "fs";

const DOMAIN = "https://atlanticdrive.bg";
const API_BASE = "https://atlanticdriveapi.azurewebsites.net";
const LISTINGS_URL = `${API_BASE}/api/public/listings`;

const staticPages = [
  `${DOMAIN}/`,
  `${DOMAIN}/catalog.html`,
  `${DOMAIN}/bezmiten-vnos.html`,
  `${DOMAIN}/dostavka-avtomobil.html`,
  `${DOMAIN}/leads.html`,
  `${DOMAIN}/logIn.html`,
  `${DOMAIN}/my-clients.html`,
  `${DOMAIN}/my-listings.html`,
  `${DOMAIN}/vnos-po-porachka.html`,
];

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;

  // чести варианти
  if (payload?.items && Array.isArray(payload.items)) return payload.items;
  if (payload?.listings && Array.isArray(payload.listings)) return payload.listings;
  if (payload?.data && Array.isArray(payload.data)) return payload.data;
  if (payload?.results && Array.isArray(payload.results)) return payload.results;

  return [];
}

function extractId(x) {
  return (
    x?.listing_id ??      // ✅ твоят формат
    x?.listingId ??
    x?.ListingId ??
    x?.id ??
    x?.Id ??
    x?.ID ??
    null
  );
}


async function fetchAllListings() {
  const take = 200;
  let skip = 0;
  const all = [];

  while (true) {
    const url = `${LISTINGS_URL}?skip=${skip}&take=${take}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Fetch failed: ${res.status} ${res.statusText} :: ${txt}`);
    }

    const payload = await res.json().catch(() => null);
    const arr = extractArray(payload);

    if (!arr || arr.length === 0) break;

    all.push(...arr);
    skip += take;

    // ако API връща по-малко от take, значи сме накрая
    if (arr.length < take) break;
  }

  return all;
}

async function main() {
  const listings = await fetchAllListings();

  const ids = listings
    .map(extractId)
    .filter(v => v !== null && v !== undefined)
    .map(v => String(v));

  const listingPages = ids.map(id => `${DOMAIN}/detail.html?id=${encodeURIComponent(id)}`);

  const urls = [...new Set([...staticPages, ...listingPages])];

  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.replace(/&/g, "&amp;")}</loc></url>`).join("\n")}
</urlset>
`;

  fs.writeFileSync("./sitemap.xml", xml, "utf8");
  console.log(`✅ sitemap.xml generated: ${urls.length} URLs (listings: ${listingPages.length})`);
}

main().catch(err => {
  console.error("❌", err.message);
  process.exit(1);
});

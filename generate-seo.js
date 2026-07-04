// generate-seo.js — สร้างหน้า SEO static + sitemap.xml สำหรับ shop.racinggarage.net
// วิธีใช้: วางไฟล์นี้ในโฟลเดอร์ repo shop (ที่เดียวกับ index.html) แล้วรัน:  node generate-seo.js
// ต้องใช้ Node 18 ขึ้นไป (มี fetch ในตัว)

const fs = require("fs");
const path = require("path");

const PROJECT = "thai-accounting-d3e6b";
const API_KEY = "AIzaSyCttc2r7PnKnI8dZDGGPuvJWqvib0UMjLc"; // web api key (public อยู่แล้วใน index.html)
const SITE = "https://shop.racinggarage.net";
const OUT_DIR = path.join(__dirname, "p");

// ---------- ดึงสินค้าทั้งหมดจาก Firestore (REST) ----------
async function fetchAll() {
  const docs = [];
  let pageToken = "";
  while (true) {
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/products` +
      `?pageSize=300&key=${API_KEY}` + (pageToken ? `&pageToken=${pageToken}` : "");
    const res = await fetch(url);
    if (!res.ok) throw new Error("Firestore fetch failed: " + res.status);
    const data = await res.json();
    for (const d of data.documents || []) {
      const id = d.name.split("/").pop();
      const f = d.fields || {};
      const val = (k) => {
        const v = f[k];
        if (!v) return undefined;
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.integerValue !== undefined) return Number(v.integerValue);
        if (v.doubleValue !== undefined) return Number(v.doubleValue);
        if (v.arrayValue) return (v.arrayValue.values || []).map((x) => x.stringValue).filter(Boolean);
        return undefined;
      };
      docs.push({
        id,
        name: val("name") || "",
        price: val("price") || 0,
        stock: val("stock") || 0,
        brand: val("brand") || "",
        category: val("category") || "",
        description: val("description") || "",
        images: val("images") || [],
        imageUrl: val("imageUrl") || "",
      });
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return docs;
}

// ---------- จัดกลุ่ม variant (logic เดียวกับหน้า shop) ----------
function baseName(name) {
  return name
    .replace(/\s+(XXS|XS|S|M|L|XL|XXL|3XL|4XL|5XL|6XL|7XL|\d{2,3}cm|\d{2})\s*[/|]\s*.*$/i, "")
    .replace(/\s+(Black|White|Red|Blue|Navy|Grey|Gray|Silver|Yellow|Orange|Green|Pink|Purple|Brown)\s*$/i, "")
    .trim();
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------- สร้าง HTML ต่อสินค้า ----------
function pageHtml(g) {
  const title = `${g.name} | Racing Garage`;
  const desc = (g.description || `${g.name} ของแท้ 100% จาก Racing Garage อุปกรณ์มอเตอร์สปอร์ต ส่งทั่วไทย โทร 089-140-0606`)
    .replace(/\s+/g, " ").slice(0, 155);
  const img = g.image || `${SITE}/`;
  const url = `${SITE}/p/${g.id}.html`;
  const spa = `${SITE}/#pid=${g.id}`;
  const priceTxt = g.price ? g.price.toLocaleString("th-TH") + " บาท" : "สอบถามราคา";
  const jsonld = {
    "@context": "https://schema.org", "@type": "Product",
    name: g.name, image: g.image ? [g.image] : undefined,
    description: desc, brand: g.brand ? { "@type": "Brand", name: g.brand } : undefined,
    offers: {
      "@type": "Offer", url: spa, priceCurrency: "THB", price: g.price || 0,
      availability: g.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      seller: { "@type": "Organization", name: "Racing Garage" },
    },
  };
  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="product">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${url}">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>body{background:#111;color:#eee;font-family:system-ui,sans-serif;margin:0;padding:20px;text-align:center}
img.p{max-width:min(420px,90vw);border-radius:8px;background:#fff}
h1{font-size:1.3rem}.price{color:#e8172c;font-size:1.6rem;font-weight:900}
a.btn{display:inline-block;margin-top:14px;padding:12px 34px;background:#e8172c;color:#fff;text-decoration:none;border-radius:6px;font-weight:700}
.meta{color:#999;font-size:.9rem;margin-top:8px}p.d{max-width:640px;margin:12px auto;color:#ccc;text-align:left}</style>
</head><body>
<a href="${SITE}/" style="color:#e8172c;font-weight:900;font-style:italic;font-size:1.4rem;text-decoration:none">Racing <span style="color:#fff">Garage</span></a>
<h1>${esc(g.name)}</h1>
${g.image ? `<img class="p" src="${esc(g.image)}" alt="${esc(g.name)}">` : ""}
<div class="price">${priceTxt}</div>
${g.sizes.length ? `<div class="meta">ไซส์: ${esc(g.sizes.join(", "))}</div>` : ""}
${g.brand ? `<div class="meta">แบรนด์: ${esc(g.brand)}${g.category ? " | หมวด: " + esc(g.category) : ""}</div>` : ""}
<a class="btn" href="${spa}">ดูรายละเอียด / สั่งซื้อ</a>
${g.description ? `<p class="d">${esc(g.description).slice(0, 1200)}</p>` : ""}
<div class="meta">Racing Garage — อุปกรณ์มอเตอร์สปอร์ตแท้ 100% | โทร 089-140-0606 | ส่งทั่วประเทศ</div>
</body></html>`;
}

// ---------- main ----------
(async () => {
  console.log("กำลังดึงสินค้าจาก Firestore...");
  const prods = (await fetchAll()).filter((p) => p.name);
  console.log("สินค้าทั้งหมด:", prods.length);

  // group by baseName
  const groups = new Map();
  for (const p of prods) {
    const key = baseName(p.name) || p.name;
    if (!groups.has(key)) groups.set(key, { name: key, items: [] });
    groups.get(key).items.push(p);
  }
  console.log("จำนวนกลุ่มสินค้า (หน้า SEO):", groups.size);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const urls = [`${SITE}/`];
  for (const g of groups.values()) {
    // เลือกตัวแทน: ตัวที่มี stock > 0 ก่อน
    const rep = g.items.find((x) => x.stock > 0) || g.items[0];
    const sizes = [];
    for (const it of g.items) {
      const m = it.name.match(/\s(XXS|XS|S|M|L|XL|XXL|3XL|4XL|5XL|6XL|7XL|\d{2,3}cm|\d{2})\s*[/|]?/i);
      if (m && !sizes.includes(m[1])) sizes.push(m[1]);
    }
    const data = {
      id: rep.id, name: g.name, price: rep.price, stock: g.items.reduce((s, x) => s + (x.stock || 0), 0),
      brand: rep.brand, category: rep.category, description: rep.description,
      image: (rep.images && rep.images[0]) || rep.imageUrl || "", sizes,
    };
    fs.writeFileSync(path.join(OUT_DIR, `${rep.id}.html`), pageHtml(data), "utf8");
    urls.push(`${SITE}/p/${rep.id}.html`);
  }

  // sitemap.xml
  const today = new Date().toISOString().slice(0, 10);
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `<url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join("\n") +
    `\n</urlset>`;
  fs.writeFileSync(path.join(__dirname, "sitemap.xml"), sitemap, "utf8");

  // robots.txt
  fs.writeFileSync(path.join(__dirname, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`, "utf8");

  console.log(`เสร็จ! สร้างหน้า SEO ${groups.size} หน้าในโฟลเดอร์ /p, sitemap.xml, robots.txt`);
  console.log("ต่อไป: commit + push ด้วย GitHub Desktop แล้วไปยืนยันเว็บใน Google Search Console");
})();

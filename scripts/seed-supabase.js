/**
 * scripts/seed-supabase.js
 * ────────────────────────
 * Automated Supabase Seed Script.
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local,
 * verifies connection, and seeds:
 *  1. categories
 *  2. catalog_items (with regular_price, member_price, price_type, details, formatting)
 *  3. products (backward-compatible POS table)
 *
 * Usage:
 *   node scripts/seed-supabase.js
 */

const fs = require('fs');
const path = require('path');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

// Load environment variables
loadEnv(path.join(__dirname, '..', '.env.local'));
loadEnv(path.join(__dirname, '..', '.env'));

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://txryikxpggbiijrmkwjp.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4cnlpa3hwZ2diaWlqcm1rd2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzAzNjgsImV4cCI6MjEwNjQ0NjM2OH0.zS5C3twDYgBQ0MOswCj9CIhp_5-yDOAHO8o2OXnT3ms';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[seed-supabase] ❌ ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Complete Seed Catalog Dataset ────────────────────────────
const SALON_CATALOG = [
  {
    category: 'Facial',
    services: [
      { name: 'Mini Facial', price: 250, member: 200, type: 'FIXED', details: 'Member Price: ₹200', formatted: '₹250' },
      { name: 'DetoxMini Facial', price: 300, member: 240, type: 'FIXED', details: 'Member Price: ₹240', formatted: '₹300' },
      { name: 'Skin Pure MF', price: 350, member: 280, type: 'FIXED', details: 'Member Price: ₹280', formatted: '₹350' },
      { name: 'Clean up', price: 400, member: 200, type: 'FIXED', details: 'Member Price: ₹200', formatted: '₹400' },
      { name: 'Fruit Facial', price: 500, member: 400, type: 'FIXED', details: 'Member Price: ₹400', formatted: '₹500' },
      { name: 'Fruit Magic Facial', price: 600, member: 480, type: 'FIXED', details: 'Member Price: ₹480', formatted: '₹600' },
      { name: 'Herbal Facial', price: 750, member: 600, type: 'FIXED', details: 'Member Price: ₹600', formatted: '₹750' },
      { name: 'Fruit Secrets', price: 850, member: 680, type: 'FIXED', details: 'Member Price: ₹680 • Papaya, Orange, Banana', formatted: '₹850' },
      { name: 'Glow Facial', price: 1000, member: 800, type: 'FIXED', details: 'Member Price: ₹800', formatted: '₹1000' },
      { name: 'Skin Whiting Facial', price: 1500, member: null, type: 'RANGE', details: 'Range: ₹1500 to ₹4000 • Member: 20% off', formatted: '₹1500 - ₹4000' },
      { name: 'Skin Shine Facial', price: 1600, member: 1280, type: 'FIXED', details: 'Member Price: ₹1280', formatted: '₹1600' },
      { name: 'Fairness Facial', price: 2000, member: 1600, type: 'FIXED', details: 'Member Price: ₹1600', formatted: '₹2000' },
      { name: 'Skin Brightenning Facial', price: 2000, member: 1600, type: 'FIXED', details: 'Member Price: ₹1600', formatted: '₹2000' },
      { name: 'Glow Radiance Facial', price: 2500, member: 2000, type: 'FIXED', details: 'Member Price: ₹2000', formatted: '₹2500' },
      { name: 'Metal Facial', price: 800, member: null, type: 'RANGE', details: 'Range: ₹800 to ₹4000 • Gold, Diamond, Silver, Platinum • Member: 20% off', formatted: '₹800 - ₹4000' },
      { name: 'Instanglow Facial', price: 4000, member: 3200, type: 'FIXED', details: 'Member Price: ₹3200', formatted: '₹4000' },
      { name: 'Bridal Facial', price: 2500, member: null, type: 'RANGE', details: 'Range: ₹2500 to ₹7500 • Member: 20% off', formatted: '₹2500 - ₹7500' },
      { name: 'Bridal Secret Facial', price: 5000, member: null, type: 'RANGE', details: 'Range: ₹5000 to ₹10000 • Fairness, Glow, Melanin • Member: 20% off', formatted: '₹5000 - ₹10000' },
      { name: 'Bridal Fairness Treat', price: 5000, member: 4000, type: 'FIXED', details: 'Member Price: ₹4000', formatted: '₹5000' },
      { name: 'Bridal Glow Treat', price: 6000, member: 4800, type: 'FIXED', details: 'Member Price: ₹4800', formatted: '₹6000' },
      { name: 'Skin Polishing Facial', price: 5000, member: 4000, type: 'FIXED', details: 'Member Price: ₹4000', formatted: '₹5000' },
      { name: 'Skin Lightening advance Facial', price: 7000, member: 5200, type: 'FIXED', details: 'Member Price: ₹5200', formatted: '₹7000' },
      { name: 'Melanin Treat', price: 10000, member: 8000, type: 'FIXED', details: 'Member Price: ₹8000', formatted: '₹10000' },
    ]
  },
  {
    category: 'Threading',
    services: [
      { name: 'Eyebrows', price: 60, member: 50, type: 'FIXED', details: 'Member Price: ₹50', formatted: '₹60' },
      { name: 'Upperlip', price: 40, member: 35, type: 'FIXED', details: 'Member Price: ₹35', formatted: '₹40' },
      { name: 'Chin', price: 40, member: 35, type: 'FIXED', details: 'Member Price: ₹35', formatted: '₹40' },
      { name: 'Forehead', price: 20, member: 10, type: 'FIXED', details: 'Member Price: ₹10', formatted: '₹20' },
      { name: 'Cheeks', price: 40, member: 35, type: 'FIXED', details: 'Member Price: ₹35', formatted: '₹40' },
      { name: 'Full Face', price: 160, member: 120, type: 'FIXED', details: 'Member Price: ₹120', formatted: '₹160' },
    ]
  },
  {
    category: 'Waxing',
    services: [
      { name: 'Upperlip (Normal)', price: 60, member: 50, type: 'FIXED', details: 'Member Price: ₹50', formatted: '₹60' },
      { name: 'Upperlip (Flavored)', price: 70, member: 60, type: 'FIXED', details: 'Member Price: ₹60', formatted: '₹70' },
      { name: 'Chin (Normal)', price: 60, member: 50, type: 'FIXED', details: 'Member Price: ₹50', formatted: '₹60' },
      { name: 'Chin (Flavored)', price: 70, member: 60, type: 'FIXED', details: 'Member Price: ₹60', formatted: '₹70' },
      { name: 'Forehead (Normal)', price: 40, member: 35, type: 'FIXED', details: 'Member Price: ₹35', formatted: '₹40' },
      { name: 'Forehead (Flavored)', price: 50, member: 40, type: 'FIXED', details: 'Member Price: ₹40', formatted: '₹50' },
      { name: 'Cheeks (Normal)', price: 70, member: 60, type: 'FIXED', details: 'Member Price: ₹60', formatted: '₹70' },
      { name: 'Cheeks (Flavored)', price: 80, member: 70, type: 'FIXED', details: 'Member Price: ₹70', formatted: '₹80' },
      { name: 'Full Face (Normal)', price: 250, member: 200, type: 'FIXED', details: 'Member Price: ₹200', formatted: '₹250' },
      { name: 'Full Face (Flavored)', price: 300, member: 250, type: 'FIXED', details: 'Member Price: ₹250', formatted: '₹300' },
      { name: 'Half hand - Elbow (Normal)', price: 200, member: 180, type: 'FIXED', details: 'Member Price: ₹180', formatted: '₹200' },
      { name: 'Half hand - Elbow (Flavored)', price: 400, member: 350, type: 'FIXED', details: 'Member Price: ₹350', formatted: '₹400' },
      { name: 'Full hand (Normal)', price: 400, member: 350, type: 'FIXED', details: 'Member Price: ₹350', formatted: '₹400' },
      { name: 'Full hand (Flavored)', price: 800, member: 700, type: 'FIXED', details: 'Member Price: ₹700', formatted: '₹800' },
      { name: 'Half Legs - Knee (Normal)', price: 500, member: 450, type: 'FIXED', details: 'Member Price: ₹450', formatted: '₹500' },
      { name: 'Half Legs - Knee (Flavored)', price: 1000, member: 900, type: 'FIXED', details: 'Member Price: ₹900', formatted: '₹1000' },
      { name: 'Full Legs (Normal)', price: 800, member: 700, type: 'FIXED', details: 'Member Price: ₹700', formatted: '₹800' },
      { name: 'Full Legs (Flavored)', price: 1500, member: 1300, type: 'FIXED', details: 'Member Price: ₹1300', formatted: '₹1500' },
    ]
  },
  {
    category: 'De-tan',
    services: [
      { name: 'Skin Fresh', price: 400, member: 320, type: 'FIXED', details: 'Member Price: ₹320', formatted: '₹400' },
      { name: 'Glow', price: 500, member: 400, type: 'FIXED', details: 'Member Price: ₹400', formatted: '₹500' },
      { name: 'Herbal Glow', price: 600, member: 480, type: 'FIXED', details: 'Member Price: ₹480 • Sandal, Green Tea, Spirulina', formatted: '₹600' },
      { name: 'Instant Glow', price: 900, member: 720, type: 'FIXED', details: 'Member Price: ₹720', formatted: '₹900' },
      { name: 'Deep Glow', price: 1500, member: 1200, type: 'FIXED', details: 'Member Price: ₹1200', formatted: '₹1500' },
    ]
  },
  {
    category: 'Manicure',
    services: [
      { name: 'Hand Massege', price: 350, member: 280, type: 'FIXED', details: 'Member Price: ₹280', formatted: '₹350' },
      { name: 'File & Polish', price: 200, member: 180, type: 'FIXED', details: 'Member Price: ₹180', formatted: '₹200' },
      { name: 'Regular Manicure', price: 600, member: 540, type: 'FIXED', details: 'Member Price: ₹540', formatted: '₹600' },
      { name: 'Spa Manicure', price: 900, member: 810, type: 'FIXED', details: 'Member Price: ₹810', formatted: '₹900' },
      { name: 'Relaxation', price: 1200, member: 1080, type: 'FIXED', details: 'Member Price: ₹1080', formatted: '₹1200' },
    ]
  },
  {
    category: 'Pedicure',
    services: [
      { name: 'Regular Pedicure', price: 700, member: 630, type: 'FIXED', details: 'Member Price: ₹630', formatted: '₹700' },
      { name: 'Relax Massege 15mts', price: 350, member: 280, type: 'FIXED', details: 'Member Price: ₹280 • 15 minutes duration', formatted: '₹350' },
      { name: 'Spa Pedicure', price: 1000, member: 900, type: 'FIXED', details: 'Member Price: ₹900', formatted: '₹1000' },
      { name: 'Reflexsology', price: 1000, member: null, type: 'RANGE', details: 'Range: ₹1000 to ₹1500 • Member: 10% off', formatted: '₹1000 - ₹1500' },
      { name: 'Advance Care for Relax', price: 1500, member: null, type: 'RANGE', details: 'Range: ₹1500 to ₹2000 • Member: 10% off', formatted: '₹1500 - ₹2000' },
      { name: 'Heelpeel', price: 2000, member: null, type: 'RANGE', details: 'Range: ₹2000 to ₹2500 • Member: 10% off', formatted: '₹2000 - ₹2500' },
    ]
  },
  {
    category: 'Exotic Skin Special Treatments',
    services: [
      { name: 'Pimple / Acne Treatment', price: 1500, member: null, type: 'RANGE', details: 'Range: ₹1500 to ₹3000 • Member: 20% off', formatted: '₹1500 - ₹3000' },
      { name: 'Meso Therapy Treatment', price: 2000, member: 1600, type: 'FIXED', details: 'Member Price: ₹1600', formatted: '₹2000' },
      { name: 'Peels Treatment', price: 1000, member: null, type: 'RANGE', details: 'Range: ₹1000 to ₹3000 • Member: 20% off', formatted: '₹1000 - ₹3000' },
      { name: 'Dermo Roller Treatment', price: 2000, member: 1600, type: 'FIXED', details: 'Member Price: ₹1600', formatted: '₹2000' },
      { name: 'Skin Lifting Treatment', price: 2500, member: 2000, type: 'FIXED', details: 'Member Price: ₹2000', formatted: '₹2500' },
      { name: 'Under Eye Treatment', price: 1000, member: 800, type: 'FIXED', details: 'Member Price: ₹800', formatted: '₹1000' },
      { name: 'Pigmentation Treatment', price: 1800, member: 1400, type: 'FIXED', details: 'Member Price: ₹1400', formatted: '₹1800' },
      { name: 'Warts Treatment', price: 30, member: null, type: 'RANGE', details: 'Range: ₹30 to ₹500 • Member: 20% off', formatted: '₹30 - ₹500' },
      { name: 'Hydra Facial', price: 7000, member: null, type: 'FIXED', details: 'Member: 20% off', formatted: '₹7000' },
      { name: 'Carbon Peel Treatment', price: 8000, member: 6400, type: 'FIXED', details: 'Member Price: ₹6400', formatted: '₹8000' },
      { name: 'Photo facial Treatment', price: 3000, member: 2400, type: 'FIXED', details: 'Member Price: ₹2400', formatted: '₹3000' },
      { name: 'Derma Planing Treatment', price: 500, member: 400, type: 'FIXED', details: 'Member Price: ₹400', formatted: '₹500' },
      { name: 'Face Cupping Treatment', price: 1500, member: null, type: 'RANGE', details: 'Range: ₹1500 to ₹3000 • Member: 20% off', formatted: '₹1500 - ₹3000' },
      { name: 'Permanent Tattoo Removal', price: 1800, member: null, type: 'CUSTOM', details: 'Per inch', formatted: '₹1800 / inch' },
      { name: 'Melanin Treatment', price: 10000, member: 8000, type: 'FIXED', details: 'Member Price: ₹8000', formatted: '₹10000' },
      { name: 'Earlobe Treatment', price: 1800, member: null, type: 'CUSTOM', details: 'Per Ear', formatted: '₹1800 / ear' },
      { name: 'Lice & Nits Treatment', price: 3000, member: null, type: 'RANGE', details: 'Range: ₹3000 to ₹10000', formatted: '₹3000 - ₹10000' },
      { name: 'Laser Hair Removal Treatment', price: 0, member: null, type: 'CONSULTATION', details: 'Consultation required', formatted: 'On Consultation' },
    ]
  },
  {
    category: 'Hair Treatments & Scalp Care',
    services: [
      { name: 'Hairloss prevent treatment', price: 2500, member: 2000, type: 'FIXED', details: 'Member Price: ₹2000', formatted: '₹2500' },
      { name: 'Spilitage Removel with Hairspa', price: 2500, member: 2000, type: 'FIXED', details: 'Member Price: ₹2000', formatted: '₹2500' },
      { name: 'Hairfall Treatment', price: 2500, member: null, type: 'CUSTOM', details: 'Per Sitting', formatted: '₹2500 / sitting' },
      { name: 'Dandruff Treatment', price: 2500, member: null, type: 'CUSTOM', details: 'Per Sitting', formatted: '₹2500 / sitting' },
      { name: 'Hairgrowth Treatment', price: 3500, member: null, type: 'CUSTOM', details: 'Per Sitting', formatted: '₹3500 / sitting' },
      { name: 'Hot Oil Massage', price: 600, member: 480, type: 'FIXED', details: 'Member Price: ₹480', formatted: '₹600' },
      { name: 'Relaxation Head Massage', price: 1500, member: 1200, type: 'FIXED', details: 'Member Price: ₹1200', formatted: '₹1500' },
    ]
  },
  {
    category: 'Hair Cuts',
    services: [
      { name: 'Straight', price: 150, member: 120, type: 'FIXED', details: 'Member Price: ₹120', formatted: '₹150' },
      { name: 'U Cut', price: 200, member: 160, type: 'FIXED', details: 'Member Price: ₹160', formatted: '₹200' },
      { name: 'Deep U Cut', price: 250, member: 200, type: 'FIXED', details: 'Member Price: ₹200', formatted: '₹250' },
      { name: 'Front Fringes Cut', price: 100, member: 80, type: 'FIXED', details: 'Member Price: ₹80', formatted: '₹100' },
      { name: 'Layer Cut', price: 700, member: 560, type: 'FIXED', details: 'Member Price: ₹560', formatted: '₹700' },
      { name: 'Textured Layers Cut', price: 900, member: 720, type: 'FIXED', details: 'Member Price: ₹720', formatted: '₹900' },
      { name: 'Feather Cut', price: 800, member: 640, type: 'FIXED', details: 'Member Price: ₹640', formatted: '₹800' },
      { name: 'Fleackering Cut', price: 800, member: 640, type: 'FIXED', details: 'Member Price: ₹640', formatted: '₹800' },
      { name: 'Step Cut', price: 800, member: 640, type: 'FIXED', details: 'Member Price: ₹640', formatted: '₹800' },
      { name: 'Creative Cut', price: 1000, member: 800, type: 'FIXED', details: 'Member Price: ₹800', formatted: '₹1000' },
      { name: 'Customized Haircut', price: 1200, member: 960, type: 'FIXED', details: 'Member Price: ₹960', formatted: '₹1200' },
    ]
  },
  {
    category: 'Hair Spa',
    services: [
      { name: 'Regular Hair spa (Short)', price: 1000, member: null, type: 'FIXED', details: null, formatted: '₹1000' },
      { name: 'Regular Hair spa (Medium)', price: 1500, member: null, type: 'FIXED', details: null, formatted: '₹1500' },
      { name: 'Regular Hair spa (Long)', price: 2000, member: null, type: 'FIXED', details: null, formatted: '₹2000' },
      { name: 'Detox Hair Spa (Short)', price: 2500, member: null, type: 'FIXED', details: null, formatted: '₹2500' },
      { name: 'Detox Hair Spa (Medium)', price: 3000, member: null, type: 'FIXED', details: null, formatted: '₹3000' },
      { name: 'Detox Hair Spa (Long)', price: 3500, member: null, type: 'FIXED', details: null, formatted: '₹3500' },
      { name: 'Smoothen Hair Spa (Short)', price: 2500, member: null, type: 'FIXED', details: null, formatted: '₹2500' },
      { name: 'Smoothen Hair Spa (Medium)', price: 3000, member: null, type: 'FIXED', details: null, formatted: '₹3000' },
      { name: 'Smoothen Hair Spa (Long)', price: 3500, member: null, type: 'FIXED', details: null, formatted: '₹3500' },
      { name: 'Keratin Hair Spa (Short)', price: 3500, member: null, type: 'FIXED', details: null, formatted: '₹3500' },
      { name: 'Keratin Hair Spa (Medium)', price: 4000, member: null, type: 'FIXED', details: null, formatted: '₹4000' },
      { name: 'Keratin Hair Spa (Long)', price: 4500, member: null, type: 'FIXED', details: null, formatted: '₹4500' },
    ]
  },
  {
    category: 'Hair Wash with Condition',
    services: [
      { name: 'Short Hair Wash', price: 150, member: 130, type: 'FIXED', details: 'Member Price: ₹130', formatted: '₹150' },
      { name: 'Medium Hair Wash', price: 200, member: 180, type: 'FIXED', details: 'Member Price: ₹180', formatted: '₹200' },
      { name: 'Long Hair Wash', price: 250, member: 220, type: 'FIXED', details: 'Member Price: ₹220', formatted: '₹250' },
      { name: 'Too Long Hair', price: 300, member: 250, type: 'FIXED', details: 'Member Price: ₹250', formatted: '₹300' },
    ]
  },
  {
    category: 'Chemical Therapy',
    services: [
      { name: 'Keratin Therapy (Short)', price: 10000, member: null, type: 'FIXED', details: null, formatted: '₹10000' },
      { name: 'Keratin Therapy (Medium)', price: 14000, member: null, type: 'FIXED', details: null, formatted: '₹14000' },
      { name: 'Keratin Therapy (Long)', price: 18000, member: null, type: 'FIXED', details: null, formatted: '₹18000' },
      { name: 'Keratin Therapy (Too Long)', price: 20000, member: null, type: 'FIXED', details: null, formatted: '₹20000' },
      { name: 'Straightening (Short)', price: 5000, member: null, type: 'FIXED', details: null, formatted: '₹5000' },
      { name: 'Straightening (Medium)', price: 7000, member: null, type: 'FIXED', details: null, formatted: '₹7000' },
      { name: 'Straightening (Long)', price: 9000, member: null, type: 'FIXED', details: null, formatted: '₹9000' },
      { name: 'Straightening (Too Long)', price: 12000, member: null, type: 'FIXED', details: null, formatted: '₹12000' },
      { name: 'Smoothing (Short)', price: 5500, member: null, type: 'FIXED', details: null, formatted: '₹5500' },
      { name: 'Smoothing (Medium)', price: 7500, member: null, type: 'FIXED', details: null, formatted: '₹7500' },
      { name: 'Smoothing (Long)', price: 9500, member: null, type: 'FIXED', details: null, formatted: '₹9500' },
      { name: 'Smoothing (Too Long)', price: 12500, member: null, type: 'FIXED', details: null, formatted: '₹12500' },
      { name: 'Rebonding (Short)', price: 5500, member: null, type: 'FIXED', details: null, formatted: '₹5500' },
      { name: 'Rebonding (Medium)', price: 7500, member: null, type: 'FIXED', details: null, formatted: '₹7500' },
      { name: 'Rebonding (Long)', price: 9500, member: null, type: 'FIXED', details: null, formatted: '₹9500' },
      { name: 'Rebonding (Too Long)', price: 12500, member: null, type: 'FIXED', details: null, formatted: '₹12500' },
    ]
  },
  {
    category: 'Makeup Packages & Add-ons',
    services: [
      { name: 'Bridal Makeup Package', price: 0, member: null, type: 'CONSULTATION', details: 'Consultation • Includes Face makeup, Hairstyles, Saree drapping, Lens, Eyelashes, Hairextentions', formatted: 'On Consultation' },
      { name: 'Jewellery Rent', price: 0, member: null, type: 'CUSTOM', details: 'Separate Rent • Add-on', formatted: 'Separate Rent' },
      { name: 'Flower Charge', price: 0, member: null, type: 'CUSTOM', details: 'Separate Charge • Add-on', formatted: 'Separate Charge' },
      { name: 'Bramma Muhurtham', price: 1000, member: null, type: 'FIXED', details: 'Extra morning slot charge', formatted: '₹1000' },
      { name: 'Travelling Expenses', price: 0, member: null, type: 'CUSTOM', details: 'Billed on actuals', formatted: 'On Actuals' },
    ]
  }
];

async function seed() {
  console.log('📦 Connecting to Supabase:', SUPABASE_URL);

  // 1. Prepare Categories
  const categoryRows = SALON_CATALOG.map((cat, idx) => ({
    id: `cat-${idx + 1}`,
    name: cat.category,
    created_at: new Date('2026-01-01').toISOString(),
  }));

  console.log(`\n🗂  Upserting ${categoryRows.length} categories...`);
  const { data: catData, error: catErr } = await supabase
    .from('categories')
    .upsert(categoryRows, { onConflict: 'name' })
    .select();

  if (catErr) {
    console.error('  ❌ categories error:', catErr.message);
    if (catErr.message.includes('Could not find the table') || catErr.code === 'PGRST205') {
      console.error('\n⚠️  Please create the tables in Supabase SQL Editor first using supabase-schema.sql');
      return;
    }
  } else {
    console.log(`  ✅ ${categoryRows.length} categories upserted successfully`);
  }

  // 2. Prepare Catalog Items & Products
  const catalogItemRows = [];
  const productRows = [];
  let itemCounter = 1;

  for (let cIdx = 0; cIdx < SALON_CATALOG.length; cIdx++) {
    const group = SALON_CATALOG[cIdx];
    const categoryId = `cat-${cIdx + 1}`;

    for (const s of group.services) {
      const id = `ci-${itemCounter}`;
      const prodId = `lh-prod-${itemCounter}`;
      itemCounter++;

      catalogItemRows.push({
        id,
        category_id: categoryId,
        category: group.category,
        name: s.name,
        regular_price: s.price,
        member_price: s.member,
        formatted_regular_price: s.formatted || `₹${s.price}`,
        formatted_member_price: s.member ? `₹${s.member}` : (s.type === 'RANGE' ? '20% off' : null),
        price_type: s.type,
        details: s.details,
        gst_rate: 0,
        hsn_code: '9997',
        unit: 'Service',
        is_active: true,
        created_at: new Date('2026-01-01').toISOString(),
      });

      productRows.push({
        id: prodId,
        name: s.name,
        description: s.details || (s.member ? `Member Price: ₹${s.member}` : null),
        category: group.category,
        gst_rate: 0,
        hsn_code: '9997',
        selling_price: s.price,
        price: s.price,
        offer_price: s.member || s.price,
        purchase_price: 0,
        stock_quantity: 999,
        low_stock_alert: 5,
        unit: 'Service',
        unit_label: 'Service',
        item_type: 'service',
        is_active: true,
        created_at: new Date('2026-01-01').toISOString(),
      });
    }
  }

  // Upsert into catalog_items
  console.log(`\n🛍  Upserting ${catalogItemRows.length} catalog items into catalog_items table...`);
  const CHUNK = 40;
  let seededCatalogCount = 0;
  for (let i = 0; i < catalogItemRows.length; i += CHUNK) {
    const chunk = catalogItemRows.slice(i, i + CHUNK);
    const { error: ciErr } = await supabase
      .from('catalog_items')
      .upsert(chunk, { onConflict: 'id' });

    if (ciErr) {
      console.error(`  ⚠️ catalog_items chunk error (${i} to ${i + chunk.length}):`, ciErr.message);
    } else {
      seededCatalogCount += chunk.length;
    }
  }
  console.log(`  ✅ ${seededCatalogCount} / ${catalogItemRows.length} catalog_items seeded`);

  // Upsert into products (for POS compatibility)
  console.log(`\n📦 Upserting ${productRows.length} products into products table...`);
  let seededProductCount = 0;
  for (let i = 0; i < productRows.length; i += CHUNK) {
    const chunk = productRows.slice(i, i + CHUNK);
    const { error: prodErr } = await supabase
      .from('products')
      .upsert(chunk, { onConflict: 'id' });

    if (prodErr) {
      console.error(`  ⚠️ products chunk error (${i} to ${i + chunk.length}):`, prodErr.message);
    } else {
      seededProductCount += chunk.length;
    }
  }
  console.log(`  ✅ ${seededProductCount} / ${productRows.length} products seeded`);

  console.log('\n🎉 Seeding complete!');
}

seed().catch((err) => {
  console.error('Seed execution error:', err);
  process.exit(1);
});

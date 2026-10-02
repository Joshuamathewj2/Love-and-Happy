import { Category, Product } from './types';

export interface RawService {
  name: string;
  regular_price: number | string;
  member_price: number | string | null;
  details: string | null;
  duration?: string;
  unit?: string;
  price_type?: string;
  formatted_regular_price?: string;
  formatted_member_price?: string;
}

export interface RawCategory {
  category_name: string;
  services: RawService[];
}

export const SALON_RAW_CATALOG: RawCategory[] = [
  {
    category_name: 'Facial',
    services: [
      { name: 'Mini Facial', regular_price: 250, member_price: 200, details: 'Member Price: ₹200', price_type: 'FIXED' },
      { name: 'DetoxMini Facial', regular_price: 300, member_price: 240, details: 'Member Price: ₹240', price_type: 'FIXED' },
      { name: 'Skin Pure MF', regular_price: 350, member_price: 280, details: 'Member Price: ₹280', price_type: 'FIXED' },
      { name: 'Clean up', regular_price: 400, member_price: 200, details: 'Member Price: ₹200', price_type: 'FIXED' },
      { name: 'Fruit Facial', regular_price: 500, member_price: 400, details: 'Member Price: ₹400', price_type: 'FIXED' },
      { name: 'Fruit Magic Facial', regular_price: 600, member_price: 480, details: 'Member Price: ₹480', price_type: 'FIXED' },
      { name: 'Herbal Facial', regular_price: 750, member_price: 600, details: 'Member Price: ₹600', price_type: 'FIXED' },
      { name: 'Fruit Secrets', regular_price: 850, member_price: 680, details: 'Member Price: ₹680 • Papaya, Orange, Banana', price_type: 'FIXED' },
      { name: 'Glow Facial', regular_price: 1000, member_price: 800, details: 'Member Price: ₹800', price_type: 'FIXED' },
      { name: 'Skin Whiting Facial', regular_price: 1500, member_price: null, details: 'Range: ₹1500 to ₹4000 • Member: 20% off', price_type: 'RANGE', formatted_regular_price: '₹1500 - ₹4000' },
      { name: 'Skin Shine Facial', regular_price: 1600, member_price: 1280, details: 'Member Price: ₹1280', price_type: 'FIXED' },
      { name: 'Fairness Facial', regular_price: 2000, member_price: 1600, details: 'Member Price: ₹1600', price_type: 'FIXED' },
      { name: 'Skin Brightenning Facial', regular_price: 2000, member_price: 1600, details: 'Member Price: ₹1600', price_type: 'FIXED' },
      { name: 'Glow Radiance Facial', regular_price: 2500, member_price: 2000, details: 'Member Price: ₹2000', price_type: 'FIXED' },
      { name: 'Metal Facial', regular_price: 800, member_price: null, details: 'Range: ₹800 to ₹4000 • Gold, Diamond, Silver, Platinum • Member: 20% off', price_type: 'RANGE', formatted_regular_price: '₹800 - ₹4000' },
      { name: 'Instanglow Facial', regular_price: 4000, member_price: 3200, details: 'Member Price: ₹3200', price_type: 'FIXED' },
      { name: 'Bridal Facial', regular_price: 2500, member_price: null, details: 'Range: ₹2500 to ₹7500 • Member: 20% off', price_type: 'RANGE', formatted_regular_price: '₹2500 - ₹7500' },
      { name: 'Bridal Secret Facial', regular_price: 5000, member_price: null, details: 'Range: ₹5000 to ₹10000 • Fairness, Glow, Melanin • Member: 20% off', price_type: 'RANGE', formatted_regular_price: '₹5000 - ₹10000' },
      { name: 'Bridal Fairness Treat', regular_price: 5000, member_price: 4000, details: 'Member Price: ₹4000', price_type: 'FIXED' },
      { name: 'Bridal Glow Treat', regular_price: 6000, member_price: 4800, details: 'Member Price: ₹4800', price_type: 'FIXED' },
      { name: 'Skin Polishing Facial', regular_price: 5000, member_price: 4000, details: 'Member Price: ₹4000', price_type: 'FIXED' },
      { name: 'Skin Lightening advance Facial', regular_price: 7000, member_price: 5200, details: 'Member Price: ₹5200', price_type: 'FIXED' },
      { name: 'Melanin Treat', regular_price: 10000, member_price: 8000, details: 'Member Price: ₹8000', price_type: 'FIXED' },
    ]
  },
  {
    category_name: 'Threading',
    services: [
      { name: 'Eyebrows', regular_price: 60, member_price: 50, details: 'Member Price: ₹50', price_type: 'FIXED' },
      { name: 'Upperlip', regular_price: 40, member_price: 35, details: 'Member Price: ₹35', price_type: 'FIXED' },
      { name: 'Chin', regular_price: 40, member_price: 35, details: 'Member Price: ₹35', price_type: 'FIXED' },
      { name: 'Forehead', regular_price: 20, member_price: 10, details: 'Member Price: ₹10', price_type: 'FIXED' },
      { name: 'Cheeks', regular_price: 40, member_price: 35, details: 'Member Price: ₹35', price_type: 'FIXED' },
      { name: 'Full Face', regular_price: 160, member_price: 120, details: 'Member Price: ₹120', price_type: 'FIXED' },
    ]
  },
  {
    category_name: 'Waxing',
    services: [
      { name: 'Upperlip (Normal)', regular_price: 60, member_price: 50, details: 'Member Price: ₹50', price_type: 'FIXED' },
      { name: 'Upperlip (Flavored)', regular_price: 70, member_price: 60, details: 'Member Price: ₹60', price_type: 'FIXED' },
      { name: 'Chin (Normal)', regular_price: 60, member_price: 50, details: 'Member Price: ₹50', price_type: 'FIXED' },
      { name: 'Chin (Flavored)', regular_price: 70, member_price: 60, details: 'Member Price: ₹60', price_type: 'FIXED' },
      { name: 'Forehead (Normal)', regular_price: 40, member_price: 35, details: 'Member Price: ₹35', price_type: 'FIXED' },
      { name: 'Forehead (Flavored)', regular_price: 50, member_price: 40, details: 'Member Price: ₹40', price_type: 'FIXED' },
      { name: 'Cheeks (Normal)', regular_price: 70, member_price: 60, details: 'Member Price: ₹60', price_type: 'FIXED' },
      { name: 'Cheeks (Flavored)', regular_price: 80, member_price: 70, details: 'Member Price: ₹70', price_type: 'FIXED' },
      { name: 'Full Face (Normal)', regular_price: 250, member_price: 200, details: 'Member Price: ₹200', price_type: 'FIXED' },
      { name: 'Full Face (Flavored)', regular_price: 300, member_price: 250, details: 'Member Price: ₹250', price_type: 'FIXED' },
      { name: 'Half hand - Elbow (Normal)', regular_price: 200, member_price: 180, details: 'Member Price: ₹180', price_type: 'FIXED' },
      { name: 'Half hand - Elbow (Flavored)', regular_price: 400, member_price: 350, details: 'Member Price: ₹350', price_type: 'FIXED' },
      { name: 'Full hand (Normal)', regular_price: 400, member_price: 350, details: 'Member Price: ₹350', price_type: 'FIXED' },
      { name: 'Full hand (Flavored)', regular_price: 800, member_price: 700, details: 'Member Price: ₹700', price_type: 'FIXED' },
      { name: 'Half Legs - Knee (Normal)', regular_price: 500, member_price: 450, details: 'Member Price: ₹450', price_type: 'FIXED' },
      { name: 'Half Legs - Knee (Flavored)', regular_price: 1000, member_price: 900, details: 'Member Price: ₹900', price_type: 'FIXED' },
      { name: 'Full Legs (Normal)', regular_price: 800, member_price: 700, details: 'Member Price: ₹700', price_type: 'FIXED' },
      { name: 'Full Legs (Flavored)', regular_price: 1500, member_price: 1300, details: 'Member Price: ₹1300', price_type: 'FIXED' },
    ]
  },
  {
    category_name: 'De-tan',
    services: [
      { name: 'Skin Fresh', regular_price: 400, member_price: 320, details: 'Member Price: ₹320', price_type: 'FIXED' },
      { name: 'Glow', regular_price: 500, member_price: 400, details: 'Member Price: ₹400', price_type: 'FIXED' },
      { name: 'Herbal Glow', regular_price: 600, member_price: 480, details: 'Member Price: ₹480 • Sandal, Green Tea, Spirulina', price_type: 'FIXED' },
      { name: 'Instant Glow', regular_price: 900, member_price: 720, details: 'Member Price: ₹720', price_type: 'FIXED' },
      { name: 'Deep Glow', regular_price: 1500, member_price: 1200, details: 'Member Price: ₹1200', price_type: 'FIXED' },
    ]
  },
  {
    category_name: 'Manicure',
    services: [
      { name: 'Hand Massege', regular_price: 350, member_price: 280, details: 'Member Price: ₹280', price_type: 'FIXED' },
      { name: 'File & Polish', regular_price: 200, member_price: 180, details: 'Member Price: ₹180', price_type: 'FIXED' },
      { name: 'Regular Manicure', regular_price: 600, member_price: 540, details: 'Member Price: ₹540', price_type: 'FIXED' },
      { name: 'Spa Manicure', regular_price: 900, member_price: 810, details: 'Member Price: ₹810', price_type: 'FIXED' },
      { name: 'Relaxation', regular_price: 1200, member_price: 1080, details: 'Member Price: ₹1080', price_type: 'FIXED' },
    ]
  },
  {
    category_name: 'Pedicure',
    services: [
      { name: 'Regular Pedicure', regular_price: 700, member_price: 630, details: 'Member Price: ₹630', price_type: 'FIXED' },
      { name: 'Relax Massege 15mts', regular_price: 350, member_price: 280, details: 'Member Price: ₹280 • 15 minutes duration', price_type: 'FIXED' },
      { name: 'Spa Pedicure', regular_price: 1000, member_price: 900, details: 'Member Price: ₹900', price_type: 'FIXED' },
      { name: 'Reflexsology', regular_price: 1000, member_price: null, details: 'Range: ₹1000 to ₹1500 • Member: 10% off', price_type: 'RANGE', formatted_regular_price: '₹1000 - ₹1500' },
      { name: 'Advance Care for Relax', regular_price: 1500, member_price: null, details: 'Range: ₹1500 to ₹2000 • Member: 10% off', price_type: 'RANGE', formatted_regular_price: '₹1500 - ₹2000' },
      { name: 'Heelpeel', regular_price: 2000, member_price: null, details: 'Range: ₹2000 to ₹2500 • Member: 10% off', price_type: 'RANGE', formatted_regular_price: '₹2000 - ₹2500' },
    ]
  },
  {
    category_name: 'Exotic Skin Special Treatments',
    services: [
      { name: 'Pimple / Acne Treatment', regular_price: 1500, member_price: null, details: 'Range: ₹1500 to ₹3000 • Member: 20% off', price_type: 'RANGE', formatted_regular_price: '₹1500 - ₹3000' },
      { name: 'Meso Therapy Treatment', regular_price: 2000, member_price: 1600, details: 'Member Price: ₹1600', price_type: 'FIXED' },
      { name: 'Peels Treatment', regular_price: 1000, member_price: null, details: 'Range: ₹1000 to ₹3000 • Member: 20% off', price_type: 'RANGE', formatted_regular_price: '₹1000 - ₹3000' },
      { name: 'Dermo Roller Treatment', regular_price: 2000, member_price: 1600, details: 'Member Price: ₹1600', price_type: 'FIXED' },
      { name: 'Skin Lifting Treatment', regular_price: 2500, member_price: 2000, details: 'Member Price: ₹2000', price_type: 'FIXED' },
      { name: 'Under Eye Treatment', regular_price: 1000, member_price: 800, details: 'Member Price: ₹800', price_type: 'FIXED' },
      { name: 'Pigmentation Treatment', regular_price: 1800, member_price: 1400, details: 'Member Price: ₹1400', price_type: 'FIXED' },
      { name: 'Warts Treatment', regular_price: 30, member_price: null, details: 'Range: ₹30 to ₹500 • Member: 20% off', price_type: 'RANGE', formatted_regular_price: '₹30 - ₹500' },
      { name: 'Hydra Facial', regular_price: 7000, member_price: null, details: 'Member: 20% off', price_type: 'FIXED' },
      { name: 'Carbon Peel Treatment', regular_price: 8000, member_price: 6400, details: 'Member Price: ₹6400', price_type: 'FIXED' },
      { name: 'Photo facial Treatment', regular_price: 3000, member_price: 2400, details: 'Member Price: ₹2400', price_type: 'FIXED' },
      { name: 'Derma Planing Treatment', regular_price: 500, member_price: 400, details: 'Member Price: ₹400', price_type: 'FIXED' },
      { name: 'Face Cupping Treatment', regular_price: 1500, member_price: null, details: 'Range: ₹1500 to ₹3000 • Member: 20% off', price_type: 'RANGE', formatted_regular_price: '₹1500 - ₹3000' },
      { name: 'Permanent Tattoo Removal', regular_price: 1800, member_price: null, details: 'Per inch', price_type: 'CUSTOM', formatted_regular_price: '₹1800 / inch' },
      { name: 'Melanin Treatment', regular_price: 10000, member_price: 8000, details: 'Member Price: ₹8000', price_type: 'FIXED' },
      { name: 'Earlobe Treatment', regular_price: 1800, member_price: null, details: 'Per Ear', price_type: 'CUSTOM', formatted_regular_price: '₹1800 / ear' },
      { name: 'Lice & Nits Treatment', regular_price: 3000, member_price: null, details: 'Range: ₹3000 to ₹10000', price_type: 'RANGE', formatted_regular_price: '₹3000 - ₹10000' },
      { name: 'Laser Hair Removal Treatment', regular_price: 0, member_price: null, details: 'Consultation required', price_type: 'CONSULTATION', formatted_regular_price: 'On Consultation' },
    ]
  },
  {
    category_name: 'Hair Treatments & Scalp Care',
    services: [
      { name: 'Hairloss prevent treatment', regular_price: 2500, member_price: 2000, details: 'Member Price: ₹2000', price_type: 'FIXED' },
      { name: 'Spilitage Removel with Hairspa', regular_price: 2500, member_price: 2000, details: 'Member Price: ₹2000', price_type: 'FIXED' },
      { name: 'Hairfall Treatment', regular_price: 2500, member_price: null, details: 'Per Sitting', price_type: 'CUSTOM', formatted_regular_price: '₹2500 / sitting' },
      { name: 'Dandruff Treatment', regular_price: 2500, member_price: null, details: 'Per Sitting', price_type: 'CUSTOM', formatted_regular_price: '₹2500 / sitting' },
      { name: 'Hairgrowth Treatment', regular_price: 3500, member_price: null, details: 'Per Sitting', price_type: 'CUSTOM', formatted_regular_price: '₹3500 / sitting' },
      { name: 'Hot Oil Massage', regular_price: 600, member_price: 480, details: 'Member Price: ₹480', price_type: 'FIXED' },
      { name: 'Relaxation Head Massage', regular_price: 1500, member_price: 1200, details: 'Member Price: ₹1200', price_type: 'FIXED' },
    ]
  },
  {
    category_name: 'Hair Cuts',
    services: [
      { name: 'Straight', regular_price: 150, member_price: 120, details: 'Member Price: ₹120', price_type: 'FIXED' },
      { name: 'U Cut', regular_price: 200, member_price: 160, details: 'Member Price: ₹160', price_type: 'FIXED' },
      { name: 'Deep U Cut', regular_price: 250, member_price: 200, details: 'Member Price: ₹200', price_type: 'FIXED' },
      { name: 'Front Fringes Cut', regular_price: 100, member_price: 80, details: 'Member Price: ₹80', price_type: 'FIXED' },
      { name: 'Layer Cut', regular_price: 700, member_price: 560, details: 'Member Price: ₹560', price_type: 'FIXED' },
      { name: 'Textured Layers Cut', regular_price: 900, member_price: 720, details: 'Member Price: ₹720', price_type: 'FIXED' },
      { name: 'Feather Cut', regular_price: 800, member_price: 640, details: 'Member Price: ₹640', price_type: 'FIXED' },
      { name: 'Fleackering Cut', regular_price: 800, member_price: 640, details: 'Member Price: ₹640', price_type: 'FIXED' },
      { name: 'Step Cut', regular_price: 800, member_price: 640, details: 'Member Price: ₹640', price_type: 'FIXED' },
      { name: 'Creative Cut', regular_price: 1000, member_price: 800, details: 'Member Price: ₹800', price_type: 'FIXED' },
      { name: 'Customized Haircut', regular_price: 1200, member_price: 960, details: 'Member Price: ₹960', price_type: 'FIXED' },
    ]
  },
  {
    category_name: 'Hair Spa',
    services: [
      { name: 'Regular Hair spa (Short)', regular_price: 1000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Regular Hair spa (Medium)', regular_price: 1500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Regular Hair spa (Long)', regular_price: 2000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Detox Hair Spa (Short)', regular_price: 2500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Detox Hair Spa (Medium)', regular_price: 3000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Detox Hair Spa (Long)', regular_price: 3500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Smoothen Hair Spa (Short)', regular_price: 2500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Smoothen Hair Spa (Medium)', regular_price: 3000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Smoothen Hair Spa (Long)', regular_price: 3500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Keratin Hair Spa (Short)', regular_price: 3500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Keratin Hair Spa (Medium)', regular_price: 4000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Keratin Hair Spa (Long)', regular_price: 4500, member_price: null, details: null, price_type: 'FIXED' },
    ]
  },
  {
    category_name: 'Hair Wash with Condition',
    services: [
      { name: 'Short Hair Wash', regular_price: 150, member_price: 130, details: 'Member Price: ₹130', price_type: 'FIXED' },
      { name: 'Medium Hair Wash', regular_price: 200, member_price: 180, details: 'Member Price: ₹180', price_type: 'FIXED' },
      { name: 'Long Hair Wash', regular_price: 250, member_price: 220, details: 'Member Price: ₹220', price_type: 'FIXED' },
      { name: 'Too Long Hair', regular_price: 300, member_price: 250, details: 'Member Price: ₹250', price_type: 'FIXED' },
    ]
  },
  {
    category_name: 'Chemical Therapy',
    services: [
      { name: 'Keratin Therapy (Short)', regular_price: 10000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Keratin Therapy (Medium)', regular_price: 14000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Keratin Therapy (Long)', regular_price: 18000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Keratin Therapy (Too Long)', regular_price: 20000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Straightening (Short)', regular_price: 5000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Straightening (Medium)', regular_price: 7000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Straightening (Long)', regular_price: 9000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Straightening (Too Long)', regular_price: 12000, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Smoothing (Short)', regular_price: 5500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Smoothing (Medium)', regular_price: 7500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Smoothing (Long)', regular_price: 9500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Smoothing (Too Long)', regular_price: 12500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Rebonding (Short)', regular_price: 5500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Rebonding (Medium)', regular_price: 7500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Rebonding (Long)', regular_price: 9500, member_price: null, details: null, price_type: 'FIXED' },
      { name: 'Rebonding (Too Long)', regular_price: 12500, member_price: null, details: null, price_type: 'FIXED' },
    ]
  },
  {
    category_name: 'Makeup Packages & Add-ons',
    services: [
      { name: 'Bridal Makeup Package', regular_price: 0, member_price: null, details: 'Consultation • Includes Face makeup, Hairstyles, Saree drapping, Lens, Eyelashes, Hairextentions', price_type: 'CONSULTATION', formatted_regular_price: 'On Consultation' },
      { name: 'Jewellery Rent', regular_price: 0, member_price: null, details: 'Separate Rent • Add-on', price_type: 'CUSTOM', formatted_regular_price: 'Separate Rent' },
      { name: 'Flower Charge', regular_price: 0, member_price: null, details: 'Separate Charge • Add-on', price_type: 'CUSTOM', formatted_regular_price: 'Separate Charge' },
      { name: 'Bramma Muhurtham', regular_price: 1000, member_price: null, details: 'Extra morning slot charge', price_type: 'FIXED' },
      { name: 'Travelling Expenses', regular_price: 0, member_price: null, details: 'Billed on actuals', price_type: 'CUSTOM', formatted_regular_price: 'On Actuals' },
    ]
  }
];

export const SALON_CATEGORIES: Category[] = SALON_RAW_CATALOG.map((cat, idx) => ({
  id: `cat-${idx + 1}`,
  name: cat.category_name,
  created_at: new Date('2026-01-01').toISOString(),
}));

let salonProdId = 1;
export const SALON_PRODUCTS: Product[] = SALON_RAW_CATALOG.flatMap((cat) => {
  return cat.services.map((srv) => {
    const numPrice = typeof srv.regular_price === 'number' ? srv.regular_price : parseFloat(String(srv.regular_price)) || 0;
    const numMemberPrice = srv.member_price !== null && srv.member_price !== undefined
      ? (typeof srv.member_price === 'number' ? srv.member_price : parseFloat(String(srv.member_price)))
      : undefined;

    return {
      id: `lh-prod-${salonProdId++}`,
      name: srv.name,
      description: srv.details || (srv.member_price ? `Member Price: ₹${srv.member_price}` : null),
      category: cat.category_name,
      gst_rate: 0,
      hsn_code: '9997',
      selling_price: numPrice,
      price: numPrice,
      offer_price: numMemberPrice !== undefined ? numMemberPrice : numPrice,
      stock_quantity: 999,
      low_stock_alert: 5,
      unit: 'Service',
      unit_label: 'Service',
      item_type: 'service',
      is_active: true,
      created_at: new Date('2026-01-01').toISOString(),
    };
  });
});

export const SALON_CATALOG_ITEMS = SALON_PRODUCTS.map((p) => ({
  id: p.id,
  productId: p.id,
  name: p.name,
  desc: p.description || undefined,
  category: p.category || undefined,
  price: Number(p.selling_price) || 0,
  gstRate: Number(p.gst_rate) || 0,
  hsnCode: p.hsn_code || undefined,
  unit: p.unit,
  unitLabel: p.unit_label,
}));

// Default exported categories and items for the POS system
export const LOVE_AND_HAPPY_CATEGORIES = SALON_CATEGORIES;
export const LOVE_AND_HAPPY_PRODUCTS = SALON_PRODUCTS;
export const LOVE_AND_HAPPY_CATALOG_ITEMS = SALON_CATALOG_ITEMS;
export const HM_BOUTIQUE_CATEGORIES = SALON_CATEGORIES;
export const HM_BOUTIQUE_PRODUCTS = SALON_PRODUCTS;
export const HM_BOUTIQUE_CATALOG_ITEMS = SALON_CATALOG_ITEMS;

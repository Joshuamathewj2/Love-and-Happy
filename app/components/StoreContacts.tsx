import React from "react";
import { MapPin, Clock, Phone, Sparkles, Mail } from "lucide-react";

export default function StoreContacts() {
  return (
    <div className="bg-white border border-[#0097A7]/25 rounded-2xl p-8 sm:p-12 shadow-md w-full text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0097A7] via-[#00BCD4] to-[#007A87]" />

      <span className="inline-block px-3.5 py-1 bg-[#E0F7FA] border border-[#0097A7]/30 text-[#007A87] text-[10px] font-bold rounded-full tracking-wider uppercase mb-6">
        Store Directory &amp; Contacts
      </span>

      <h1 className="text-3xl font-black text-[#0097A7] leading-tight tracking-tight mb-2">
        Love &amp; Happy
      </h1>
      <p className="text-xs text-[#C62828] font-black tracking-widest uppercase mb-8">
        Unisex Salon • Beauty, Hair, Spa &amp; Bridal Care
      </p>

      <div className="space-y-6 text-left max-w-md mx-auto text-sm font-semibold text-[#1A1A1A]/80 border-t border-black/10 pt-8">
        <div className="flex items-start gap-4">
          <Sparkles className="w-5 h-5 text-[#0097A7] shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-black/50 uppercase tracking-wider mb-0.5">What We Offer</p>
            <p className="text-[#1A1A1A] leading-relaxed text-xs sm:text-sm">
              Facials &amp; Clean-ups • Exotic Skin Care • Hair Styling &amp; Cuts • Hair Spa &amp; Chemical Therapy • Waxing &amp; De-tan • Manicure &amp; Pedicure • Bridal Packages
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <MapPin className="w-5 h-5 text-[#0097A7] shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-black/50 uppercase tracking-wider mb-0.5">Address</p>
            <p className="text-[#1A1A1A] leading-relaxed font-bold">
              No 65, 4 th cross west, Thillai Nagar, Tiruchchirappalli 620018
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Phone className="w-5 h-5 text-[#0097A7] shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-black/50 uppercase tracking-wider mb-0.5">Phone Numbers</p>
            <a
              href="tel:9843112203"
              className="text-[#0097A7] hover:underline font-bold"
            >
              9843112203
            </a>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Mail className="w-5 h-5 text-[#0097A7] shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-black/50 uppercase tracking-wider mb-0.5">Email</p>
            <p className="text-[#1A1A1A]/40 italic">—</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Clock className="w-5 h-5 text-[#0097A7] shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-black/50 uppercase tracking-wider mb-0.5">Business Hours</p>
            <p className="text-[#1A1A1A] font-semibold">Open Daily</p>
          </div>
        </div>
      </div>
    </div>
  );
}

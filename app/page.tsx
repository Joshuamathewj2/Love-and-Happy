import { MapPin, Clock, Phone, Store, Scissors, Sparkles, Mail } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#1A1A1A] font-sans flex flex-col justify-between selection:bg-[#0097A7] selection:text-white">
      {/* Header */}
      <header className="border-b border-black/10 py-5 px-6 sm:px-12 flex justify-center items-center bg-white/95 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center shadow-xs p-1 border border-[#0097A7]/30 shrink-0">
            <img src="/logo.jpeg" alt="Love & Happy Unisex Salon Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-base font-black text-[#0097A7] tracking-wider uppercase block leading-tight">
              Love &amp; Happy
            </span>
            <span className="text-[10px] text-[#C62828] font-bold tracking-widest block uppercase mt-0.5">
              Unisex Salon
            </span>
          </div>
        </div>
      </header>

      {/* Main Info */}
      <main className="flex-1 max-w-xl mx-auto w-full px-6 flex flex-col justify-center items-center py-12">
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
              <Store className="w-5 h-5 text-[#0097A7] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-black/50 uppercase tracking-wider mb-0.5">Location</p>
                <p className="text-[#1A1A1A] font-bold">
                  Tiruchendur, Thoothukudi District, Tamil Nadu
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <MapPin className="w-5 h-5 text-[#0097A7] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-black/50 uppercase tracking-wider mb-0.5">Address</p>
                <p className="text-[#1A1A1A] leading-relaxed">
                  55/6, Melaratha Veethi, Tiruchendur - 628215
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Phone className="w-5 h-5 text-[#0097A7] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-black/50 uppercase tracking-wider mb-0.5">Phone Numbers</p>
                <p className="text-[#1A1A1A]">
                  8807299918
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Mail className="w-5 h-5 text-[#0097A7] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-black/50 uppercase tracking-wider mb-0.5">Email</p>
                <p className="text-[#1A1A1A]/40 italic">
                  —
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Clock className="w-5 h-5 text-[#0097A7] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-black/50 uppercase tracking-wider mb-0.5">Business Hours</p>
                <p className="text-[#1A1A1A]">
                  Open Daily
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/10 py-6 text-center bg-white">
        <p className="text-[10px] font-bold text-[#0097A7] tracking-widest uppercase">
          Love &amp; Happy • Unisex Salon
        </p>
        <p className="text-[9px] font-semibold text-black/40 uppercase tracking-wider mt-1">
          © {new Date().getFullYear()} All Rights Reserved • Powered by Cenexa Systems
        </p>
      </footer>
    </div>
  );
}

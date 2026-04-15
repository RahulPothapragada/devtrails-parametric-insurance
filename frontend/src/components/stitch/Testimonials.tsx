export function Testimonials() {
  const testimonials = [
    { quote: "Normally a rained-out day means no dinner. With FlowSecure, I received my payout before I even got home. It's magic.", author: "Rajesh K.", role: "Delivery Partner" },
    { quote: "The interface is so clean. I don't have to navigate through endless menus. It just works exactly when I need it to.", author: "Amit S.", role: "Driver" }
  ];

  return (
    <section className="py-32 bg-[#FAFAFA] border-y border-[#E5E5EA]">
       <div className="max-w-[1024px] mx-auto px-6">
          <h3 className="text-4xl font-bold tracking-tight text-center mb-20 text-[#1D1D1F]">Trusted by the community.</h3>
          <div className="grid md:grid-cols-2 gap-8">
             {testimonials.map((t, i) => (
               <div key={i} className="p-10 rounded-[2rem] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-[#E5E5EA]">
                  <p className="text-xl font-medium text-[#1D1D1F] leading-relaxed mb-10">"{t.quote}"</p>
                  <div>
                    <div className="font-semibold text-[#1D1D1F]">{t.author}</div>
                    <div className="text-[#86868B] text-sm mt-1">{t.role}</div>
                  </div>
               </div>
             ))}
          </div>
       </div>
    </section>
  );
}

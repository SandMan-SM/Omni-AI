import { motion } from "framer-motion";
import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "Omni AI completely transformed how we handle lead generation. What used to take my team 40 hours a week now runs autonomously.",
    name: "Marcus Chen",
    title: "CEO, Velocity Growth",
    tier: "Royal",
  },
  {
    quote: "The Master tier paid for itself in the first week. I went from drowning in DMs to having conversations that actually convert.",
    name: "Sarah Mitchell",
    title: "Freelance Consultant",
    tier: "Master",
  },
  {
    quote: "We scaled from $50k to $200k monthly revenue in 6 months. The system doesn't just work — it learns and improves constantly.",
    name: "David Park",
    title: "Founder, Apex Agency",
    tier: "Empire",
  },
];

export function TestimonialsSection() {
  return (
    <section className="relative py-32 px-4" id="testimonials">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Results That Speak</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            From those who've ascended through the tiers.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="relative group"
            >
              <div className="glass-card rounded-md p-8 h-full border border-white/5 group-hover:border-white/10 transition-colors flex flex-col">
                <Quote className="w-8 h-8 text-purple-500/50 mb-4" />
                
                <p className="text-gray-300 leading-relaxed flex-grow mb-6">
                  "{testimonial.quote}"
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div>
                    <p className="font-semibold text-white" data-testid={`text-testimonial-name-${index}`}>
                      {testimonial.name}
                    </p>
                    <p className="text-sm text-gray-500" data-testid={`text-testimonial-title-${index}`}>
                      {testimonial.title}
                    </p>
                  </div>
                  <span 
                    className="px-3 py-1 rounded-full bg-white/5 text-xs text-gray-400"
                    data-testid={`badge-testimonial-tier-${index}`}
                  >
                    {testimonial.tier}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

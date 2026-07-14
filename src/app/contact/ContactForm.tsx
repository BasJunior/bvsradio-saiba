'use client';

export default function ContactForm() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert("Thanks! We'll get back to you soon.");
  };

  return (
    <form 
      className="space-y-5 bg-bg-card/30 border border-white/10 p-8 rounded-2xl" 
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm mb-1.5 block">Your Name</label>
          <input 
            type="text" 
            required 
            className="w-full bg-bg-primary border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none" 
            placeholder="Aisha Moyo" 
          />
        </div>
        <div>
          <label className="text-sm mb-1.5 block">Email Address</label>
          <input 
            type="email" 
            required 
            className="w-full bg-bg-primary border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none" 
            placeholder="you@email.com" 
          />
        </div>
      </div>

      <div>
        <label className="text-sm mb-1.5 block">What are you reaching out about?</label>
        <select className="w-full bg-bg-primary border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none text-text-primary">
          <option>General inquiry</option>
          <option>Music submission / collaboration</option>
          <option>Business or advertising</option>
          <option>Press or interview request</option>
          <option>Technical issue</option>
          <option>Other</option>
        </select>
      </div>

      <div>
        <label className="text-sm mb-1.5 block">Message</label>
        <textarea 
          required 
          rows={6} 
          className="w-full bg-bg-primary border border-white/10 rounded-xl px-4 py-3 focus:border-brand outline-none resize-y" 
          placeholder="Tell us what's on your mind..."
        />
      </div>

      <button 
        type="submit" 
        className="w-full py-3.5 bg-brand hover:bg-brand-dark text-black font-semibold rounded-full text-lg mt-2 transition-all"
      >
        Send Message
      </button>
      <p className="text-center text-xs text-text-secondary">We usually reply within 1–2 business days.</p>
    </form>
  );
}

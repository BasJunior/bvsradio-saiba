import type { MetadataRoute } from "next";
import { blogPosts } from "@/lib/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    { url: "https://bvsradio.com", lastModified: new Date(), priority: 1.0 },
    { url: "https://bvsradio.com/radio", lastModified: new Date(), priority: 0.9 },
    { url: "https://bvsradio.com/catalogue", lastModified: new Date(), priority: 0.8 },
    { url: "https://bvsradio.com/shows", lastModified: new Date(), priority: 0.8 },
    { url: "https://bvsradio.com/search", lastModified: new Date(), priority: 0.7 },
    { url: "https://bvsradio.com/library", lastModified: new Date(), priority: 0.6 },
    { url: "https://bvsradio.com/upload", lastModified: new Date(), priority: 0.7 },
    { url: "https://bvsradio.com/blog", lastModified: new Date(), priority: 0.8 },
    { url: "https://bvsradio.com/shop", lastModified: new Date(), priority: 0.6 },
    { url: "https://bvsradio.com/checkout", lastModified: new Date(), priority: 0.5 },
    { url: "https://bvsradio.com/about", lastModified: new Date(), priority: 0.5 },
    { url: "https://bvsradio.com/contact", lastModified: new Date(), priority: 0.5 },
    { url: "https://bvsradio.com/privacy", lastModified: new Date(), priority: 0.3 },
    { url: "https://bvsradio.com/terms", lastModified: new Date(), priority: 0.3 },
    { url: "https://bvsradio.com/auth/signup", lastModified: new Date(), priority: 0.6 },
    { url: "https://bvsradio.com/auth/login", lastModified: new Date(), priority: 0.5 },
  ];

  const blogPages = blogPosts.map((post) => ({
    url: `https://bvsradio.com/blog/${post.slug}`,
    lastModified: new Date(),
    priority: 0.7 as const,
  }));

  return [...staticPages, ...blogPages];
}
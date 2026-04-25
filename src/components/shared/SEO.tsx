import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
}

/**
 * SEO component to update document title and meta description dynamically.
 * Place this at the top of page components.
 */
export function SEO({ title, description }: SEOProps) {
  useEffect(() => {
    const baseTitle = "Docker Dashboard";
    const fullTitle = title ? `${title} — ${baseTitle}` : baseTitle;
    
    // Update document title
    document.title = fullTitle;

    // Update meta description if provided
    if (description) {
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute("content", description);
      } else {
        // Create meta description if it doesn't exist
        const meta = document.createElement('meta');
        meta.name = "description";
        meta.content = description;
        document.head.appendChild(meta);
      }
      
      // Also update OpenGraph description
      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) {
        ogDescription.setAttribute("content", description);
      }
    }

    // Update OpenGraph title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute("content", fullTitle);
    }
    
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
      twitterTitle.setAttribute("content", fullTitle);
    }

  }, [title, description]);

  return null;
}

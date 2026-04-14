import { Router } from 'express';
import { getAllEvents, getAllTeamMembers, getAllSponsors } from './db';

const router = Router();

const BASE_URL = 'https://joggediballa.ch';

// Static pages with their priority and change frequency
const staticPages = [
  { url: '/', priority: 1.0, changefreq: 'weekly' },
  { url: '/shotcounter', priority: 0.8, changefreq: 'daily' },
  { url: '/team', priority: 0.8, changefreq: 'monthly' },
  { url: '/events', priority: 0.9, changefreq: 'weekly' },
  { url: '/sponsors', priority: 0.7, changefreq: 'monthly' },
  { url: '/contact', priority: 0.6, changefreq: 'yearly' },
  { url: '/dienstleistungen', priority: 0.7, changefreq: 'monthly' },
  { url: '/goennermitglieder', priority: 0.5, changefreq: 'monthly' },
  { url: '/impressum', priority: 0.3, changefreq: 'yearly' },
  { url: '/datenschutz', priority: 0.3, changefreq: 'yearly' },
];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

router.get('/sitemap.xml', async (req, res) => {
  try {
    // Fetch dynamic content
    const events = await getAllEvents();
    const teamMembers = await getAllTeamMembers();
    const sponsors = await getAllSponsors();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add static pages
    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(BASE_URL + page.url)}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    }

    // Add individual events (if you want event detail pages in the future)
    // For now, events are listed on /events page, so we just update that page's lastmod
    if (events.length > 0) {
      const latestEventUpdate = events.reduce((latest: Date, event: any) => {
        const eventDate = new Date(event.updatedAt || event.createdAt);
        return eventDate > latest ? eventDate : latest;
      }, new Date(0));

      // Update the events page entry with lastmod
      // (This is already included in staticPages, but we could add lastmod dynamically)
    }

    // Add team members (if you have individual member pages)
    // Currently team members are on /team page, so no individual URLs needed

    // Add sponsors (if you have individual sponsor pages)
    // Currently sponsors are on /sponsors page, so no individual URLs needed

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

export default router;

# Design Spec — Bedlay Gardens Website

Companion to `PRD-bedlay-gardens-website.md`. This document overrides any generic styling: match the look, layout, and content below. It is modelled on the approved reference design at https://vykwkpbfnb.c40.airoapp.ai/.

---

## 1. Visual identity

- **Primary colour:** royal blue (approx `#1D3FBF`–`#2447D6` range) — used for buttons, links, subheadings, stat band background, icons
- **Dark navy** (approx `#16205C`) for the stats band and footer backgrounds
- **Background:** white / very light blue-tinted off-white (`#F7F9FE`) — light, airy, lots of whitespace
- **Text:** near-black headings, medium-grey body text
- **Typography:** modern geometric sans-serif (e.g. Poppins or Inter); headings bold and large ("What We Offer" style — heavy weight, tight tracking); section subheadings in primary blue regular weight
- **Logo:** existing Bedlay Gardens logo — line-drawn pack of dogs beside "BEDLAY GARDENS" wordmark in navy. Placeholder acceptable until the real asset is supplied; keep white background behind it
- **Buttons:** solid royal-blue rounded-rectangle ("Book Now"), white text; secondary buttons as outlined or text links
- **Cards & images:** generous rounded corners (~12–16px), subtle borders/shadows; real dog photography throughout (playing dogs, group walks, grass/outdoor settings)
- **Subtle scroll-in animations** (fade/slide) are welcome but must not delay content visibility (avoid the reference site's blank-until-animated problem); content must render immediately without JS animation completing

## 2. Header / navigation

Sticky white navbar: logo left; centre links — Home, Services, How It Works, Gallery, About Us, Contact; right side — logged-in user name dropdown (or "Log in") and a solid blue **Book Now** button.

## 3. Homepage layout (section order)

1. **Hero:** full-width photographic background (dogs outdoors), overlaid with a small pill badge "Licensed & Council Approved", H1 "Professional Dog Boarding You Can Trust", subline "Safe, caring, and fully managed stays for your dog — with online booking, vaccination tracking, and real-time updates.", two CTAs: primary "Book a Stay", secondary "Dog Owner Login"
2. **Stats band** (navy/blue full-width strip, 4 stats): `10+ Years in operation` · `1000+ Dogs cared for` · `Licensed — Council approved` · `24/7 On-site supervision`
3. **What We Offer** — heading + blue subline "Everything your dog needs, managed in one place." followed by service cards (see §4): each card shows price (£), service name, duration, short description, Book Now button
4. **Feature checklist strip** (icon + text, 2 rows of 3): vaccination record verification before every stay · individual feeding plans and dietary requirements · secure online booking and payment · automated booking confirmations by email · owner portal to manage all bookings · admin dashboard for staff management
5. **How It Works** — 3 numbered steps: 01 Register Online / 02 Make a Booking / 03 Drop Off & Relax (copy as reference site)
6. **Online Management System showcase** — split section: left, copy about the owner portal and admin dashboard with ticked bullet list; right, a stylised mock admin-dashboard card (today's overview: dogs in, bookings today, pending vaccinations, arrivals list with status chips "Confirmed" / "Pending vacc.")
7. **CTA band:** "Ready to Book Your Dog's Next Stay?" + "Create an Account" button + "Already registered? Log in" link
8. **Footer** (navy): blurb, quick links, contact block, opening hours, copyright "© Mr. Robert A Innes", Privacy Policy / Terms links

## 4. Real business content (use this, not lorem ipsum)

### Services & prices (seed data)

| Service | Price | Duration | Description |
|---|---|---|---|
| Meet & Greet | £15 | 1 hour | First step before booking — a chance to make sure the fit is right |
| Day Care (Half Day) | £15 | to 12:30pm | Drop off before 9am, collect 12:30pm |
| Day Care (Full Day) | £26 | to 5pm | Drop off before 9am, collect 5pm |
| Secure Forest Walks — 1 hour | £15 | 1 hour | Private-hire securely enclosed woodland for off-lead exercise |
| Secure Forest Walks — 3 hours | £20 | 3 hours | Private-hire securely enclosed woodland for off-lead exercise |
| Home Boarding | £50 | overnight | Overnight stay |

(Prices remain admin-editable per the PRD; these are launch values. Note "Forest" spelling — the reference site's "Forrest" is a typo, correct it.)

### Contact details

- Phone: 07956 301170
- Email: bedlaygardensdogforest@gmail.com
- Address: Bedlay Gardens, Cumbernauld Road, Chryston, Glasgow G69 9HP
- Opening hours: Mon–Fri 8am–6pm · Saturday 9am–5pm · Sunday 10am–4pm · Drop-offs and collections by appointment
- Copyright: © Mr. Robert A Innes. All rights reserved.

### Trust signals

Licensed & council approved · 10+ years in operation · 1000+ dogs cared for · 24/7 on-site supervision

## 5. Application to other pages

Carry the same palette, type scale, card style, and button treatment through every page — booking flow, portal, and dashboards included (dashboards may use a denser layout but same colours/typography). Services page cards match the homepage card design. Gallery keeps the light background with rounded photo tiles.

## 6. Acceptance criteria

- Homepage section order and copy match §3–§4
- Royal blue + navy + off-white palette applied consistently across all pages, including portal and dashboards
- Content is visible immediately on load (no blank-until-animation)
- Meet & Greet appears as a bookable service (this also satisfies the PRD §13.1 trial-visit feature)

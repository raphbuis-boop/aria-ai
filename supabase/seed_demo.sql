-- =============================================================================
-- ARIA DEMO SEED — 25 NJ Clients, 6 months of history
-- Agent: Sarah Levine, RE/MAX Bergen County
--
-- HOW TO RUN:
--   1. Open Supabase SQL Editor for your project
--   2. Replace 'REPLACE-WITH-YOUR-AGENT-UUID' on the next line with your
--      auth.users.id (find it in Authentication > Users)
--   3. Run the entire script
--
-- DATES ARE ALWAYS RELATIVE TO "TODAY" — never stale.
--   The original narrative was written against a fixed anchor date of
--   2026-06-22 ("today" when the story was drafted — offers just accepted,
--   showings this week, closings next month, etc). Every timestamp in this
--   file is expressed as that original literal + v_shift, where v_shift is
--   recomputed from CURRENT_DATE every time the script runs. So the WHOLE
--   story — who's hot, who's gone quiet, which showings are this week,
--   which closings are coming up — slides forward to sit at the same
--   position relative to whatever day you actually run this on. A few rows
--   (marked below) are pinned to fixed short offsets from today instead of
--   the narrative shift, because they exist specifically to trigger
--   dashboard cards that only fire in narrow windows (a closing ≤3 days
--   out, a showing today, a brand-new MLS match ≤24h old).
--
--   Caveat: the shift moves real DATE/TIMESTAMP columns only. Free-text
--   narrative (activity bodies, transaction notes, task titles) still says
--   things like "closing July 18" — that's cosmetic flavor text, not a
--   query input, so it wasn't rewritten to match the new dates.
--
-- RE-RUNNABLE: this script now deletes and replaces this agent's demo data
--   every time it runs (see CLEANUP below), instead of aborting if data
--   already exists. That's what makes "always relative to today" actually
--   useful — you can re-run it before any demo to refresh the dates.
-- =============================================================================

DO $$
DECLARE
  -- *** REPLACE THIS WITH YOUR ACTUAL auth.users.id ***
  v_agent_id UUID := '653cc608-a055-406b-9de1-310bf76a4e75';

  -- The narrative was originally written anchored to 2026-06-22 ("today" at
  -- the time it was drafted). v_shift is the day-count between that anchor
  -- and the real CURRENT_DATE, applied to every timestamp below so the
  -- entire story recomputes relative to whenever this script actually runs.
  v_shift  INTEGER := (CURRENT_DATE - DATE '2026-06-22');
  v_today  DATE     := CURRENT_DATE;
  -- Helper: dates are stored as UTC; NJ is UTC-4 in summer (EDT)

  -- Client UUIDs
  c01 UUID := gen_random_uuid(); -- Marcus & Jen Holloway  (buyer, showing)
  c02 UUID := gen_random_uuid(); -- Rachel Kim              (buyer, showing)
  c03 UUID := gen_random_uuid(); -- Amanda & Tom Brennan   (buyer, showing)
  c04 UUID := gen_random_uuid(); -- Priya & Raj Patel      (buyer, showing)
  c05 UUID := gen_random_uuid(); -- Brian & Kelly McGrath  (buyer, showing)
  c06 UUID := gen_random_uuid(); -- Yuki Tanaka            (buyer, under_contract)
  c07 UUID := gen_random_uuid(); -- Omar & Layla Hassan    (buyer, under_contract)
  c08 UUID := gen_random_uuid(); -- Alex & Nadia Goldstein (buyer, closed)
  c09 UUID := gen_random_uuid(); -- Megan Slattery         (seller, closed)
  c10 UUID := gen_random_uuid(); -- Robert & Amy DeSantis  (buyer, closed)
  c11 UUID := gen_random_uuid(); -- Janet Kowalski         (seller, showing)
  c12 UUID := gen_random_uuid(); -- Phil & Gwen Harrington (seller, contacted)
  c13 UUID := gen_random_uuid(); -- Thomas Nguyen          (seller, under_contract)
  c14 UUID := gen_random_uuid(); -- Carol & Bob Ostrowski  (seller, showing)
  c15 UUID := gen_random_uuid(); -- Diana Fenton           (seller, contacted)
  c16 UUID := gen_random_uuid(); -- Daniel & Sofia Moretti (buyer, contacted)
  c17 UUID := gen_random_uuid(); -- Kevin Okafor           (buyer, contacted)
  c18 UUID := gen_random_uuid(); -- Chris Nakamura         (buyer, contacted)
  c19 UUID := gen_random_uuid(); -- Victor Reyes           (buyer, contacted)
  c20 UUID := gen_random_uuid(); -- Veronica & Paul Caruso (buyer, contacted)
  c21 UUID := gen_random_uuid(); -- Stephanie Walsh        (buyer, new)
  c22 UUID := gen_random_uuid(); -- Jessica Bloom          (buyer, new)
  c23 UUID := gen_random_uuid(); -- Tyler & Nicole Chambers(buyer, new)
  c24 UUID := gen_random_uuid(); -- Grace Liu              (buyer, new)
  c25 UUID := gen_random_uuid(); -- Sean Fitzpatrick       (buyer, new)

  -- Property UUIDs (11 properties)
  p01 UUID := gen_random_uuid(); -- 18 Birchwood Dr, Tenafly       $1,350,000
  p02 UUID := gen_random_uuid(); -- 94 Palisade Ave, Englewood     $799,000
  p03 UUID := gen_random_uuid(); -- 210 Hillcrest Rd, Ridgewood    $975,000
  p04 UUID := gen_random_uuid(); -- 7 Orchard Ln, Westfield        $929,000
  p05 UUID := gen_random_uuid(); -- 55 Linwood Ave, Fort Lee       $899,000
  p06 UUID := gen_random_uuid(); -- 33 River Rd, Ridgewood         $849,000  (Yuki's contract)
  p07 UUID := gen_random_uuid(); -- 12 Harbor View Ct, Fort Lee    $999,000  (Omar's contract)
  p08 UUID := gen_random_uuid(); -- 6 Elm Terrace, Westfield       $1,050,000 (Goldstein closed)
  p09 UUID := gen_random_uuid(); -- 44 Glenwood Ave, Englewood     $785,000  (Megan listing sold)
  p10 UUID := gen_random_uuid(); -- 29 Alpine Rd, Tenafly          $1,275,000 (DeSantis closed)
  p11 UUID := gen_random_uuid(); -- 17 Summit Crest Dr, Summit     $875,000
  p12 UUID := gen_random_uuid(); -- 23 Fairview Ave, Paramus       $685,000  (fresh match, Kevin)
  p13 UUID := gen_random_uuid(); -- 8 Terrace Way, Fort Lee        $625,000  (fresh match, Victor)

  -- Listing UUIDs (agent's own listings)
  l01 UUID := gen_random_uuid(); -- 44 Glenwood Ave, Englewood (Megan - sold)
  l02 UUID := gen_random_uuid(); -- 82 Prospect St, Tenafly (Janet - active)
  l03 UUID := gen_random_uuid(); -- 308 Anderson Ave, Fort Lee (Thomas - under contract)

BEGIN

  -- ===========================================================================
  -- CLEANUP: wipe this agent's PRIOR demo data, then reseed fresh.
  -- Deleting from clients cascades (ON DELETE CASCADE, see baseline schema)
  -- to activities, property_matches, showings, transactions, and tasks.
  -- properties / listings / referrals / notifications are agent-scoped, not
  -- client-scoped, so they need an explicit delete here.
  -- ===========================================================================
  DELETE FROM public.notifications WHERE agent_id = v_agent_id;
  DELETE FROM public.referrals WHERE from_agent_id = v_agent_id OR to_agent_id = v_agent_id;
  DELETE FROM public.buyer_broker_agreements WHERE agent_id = v_agent_id;
  DELETE FROM public.listings WHERE agent_id = v_agent_id;
  DELETE FROM public.properties WHERE agent_id = v_agent_id;
  DELETE FROM public.clients WHERE agent_id = v_agent_id;

  -- ===========================================================================
  -- CLIENTS (25)
  -- ===========================================================================
  INSERT INTO public.clients (
    id, agent_id, name, email, phone, source, status, lead_score,
    client_role, town, preferred_towns, nearby_towns_ok,
    budget_min, budget_max, beds_wanted, baths_wanted,
    budget_flex_pct, bed_flex, bath_flex,
    notes, last_engagement_at, automation_day,
    created_at, birthday, home_purchase_date
  ) VALUES

  -- 01 Marcus & Jen Holloway — hot buyer, Tenafly, showing
  (c01, v_agent_id, 'Marcus & Jen Holloway', 'marcus.holloway@gmail.com', '+12015550101',
   'zillow', 'showing', 9, 'buyer',
   'Tenafly', ARRAY['Tenafly','Englewood Cliffs'], true,
   1200000, 1500000, 5, 3.5, 10, 1, 0.5,
   'Pre-approved $1.4M. Two kids at Tenafly HS — must stay in district. Motivated, timeline is summer.',
   ((DATE '2026-06-20' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2025-12-29' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 02 Rachel Kim — buyer, Englewood, showing
  (c02, v_agent_id, 'Rachel Kim', 'rachel.kim@outlook.com', '+12015550102',
   'google', 'showing', 8, 'buyer',
   'Englewood', ARRAY['Englewood','Teaneck','Bergenfield'], true,
   750000, 850000, 3, 2.0, 10, 1, 0.5,
   'Single professional, commutes to NYC via GWB. Wants walkable neighborhood. Pre-approved $825K.',
   ((DATE '2026-06-19' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 1,
   ((DATE '2026-01-07' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC', (CURRENT_DATE - INTERVAL '34 years')::date, NULL),

  -- 03 Amanda & Tom Brennan — buyers, Ridgewood, showing
  (c03, v_agent_id, 'Amanda & Tom Brennan', 'tbrennan@gmail.com', '+12015550103',
   'referral', 'showing', 8, 'buyer',
   'Ridgewood', ARRAY['Ridgewood','Ho-Ho-Kus','Glen Rock'], true,
   900000, 1100000, 4, 2.5, 10, 1, 0.5,
   'Referred by Goldsteins. Two kids, schools are #1 priority. Pre-approved $1.05M. Want yard.',
   ((DATE '2026-06-21' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-02-14' + v_shift) + TIME '11:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 04 Priya & Raj Patel — buyers, Westfield, showing
  (c04, v_agent_id, 'Priya & Raj Patel', 'rpatel@gmail.com', '+19085550104',
   'zillow', 'showing', 8, 'buyer',
   'Westfield', ARRAY['Westfield','Cranford','Scotch Plains'], true,
   850000, 1000000, 4, 2.5, 10, 1, 0.5,
   'Moving from Edison. Need 4BR for parents. Pre-approved $975K. Flexible on close date.',
   ((DATE '2026-06-18' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', 1,
   ((DATE '2026-01-22' + v_shift) + TIME '09:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 05 Brian & Kelly McGrath — buyers, Englewood, showing
  (c05, v_agent_id, 'Brian & Kelly McGrath', 'brian.mcgrath@gmail.com', '+12015550105',
   'referral', 'showing', 7, 'buyer',
   'Englewood', ARRAY['Englewood','Tenafly','Cresskill'], true,
   950000, 1200000, 4, 3.0, 10, 1, 0.5,
   'Upgrading from Fort Lee condo. Kelly wants home office + mudroom. Pre-approved $1.15M.',
   ((DATE '2026-06-17' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', 2,
   ((DATE '2026-03-01' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC', (CURRENT_DATE + 6 - INTERVAL '41 years')::date, NULL),

  -- 06 Yuki Tanaka — buyer, Ridgewood, UNDER CONTRACT
  (c06, v_agent_id, 'Yuki Tanaka', 'yuki.tanaka@yahoo.com', '+12015550106',
   'google', 'under_contract', 9, 'buyer',
   'Ridgewood', ARRAY['Ridgewood'], false,
   750000, 900000, 3, 2.0, 5, 0, 0.5,
   'Offer accepted at 33 River Rd, Ridgewood for $872K. Closing July 18. Inspection done, appraisal scheduled.',
   ((DATE '2026-06-21' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-02-03' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 07 Omar & Layla Hassan — buyers, Fort Lee, UNDER CONTRACT
  (c07, v_agent_id, 'Omar & Layla Hassan', 'omar.hassan@gmail.com', '+12015550107',
   'referral', 'under_contract', 9, 'buyer',
   'Fort Lee', ARRAY['Fort Lee','Edgewater','Cliffside Park'], true,
   850000, 1050000, 4, 2.5, 10, 1, 0.5,
   'Under contract at 12 Harbor View Ct, Fort Lee $995K. Closing July 10. NYC commuters — GWB proximity key.',
   ((DATE '2026-06-20' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-01-15' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 08 Alex & Nadia Goldstein — buyers, CLOSED (April)
  (c08, v_agent_id, 'Alex & Nadia Goldstein', 'alex.goldstein@gmail.com', '+19085550108',
   'manual', 'closed', 10, 'buyer',
   'Westfield', ARRAY['Westfield'], false,
   900000, 1100000, 4, 2.5, 5, 0, 0.5,
   'CLOSED Apr 11 — 6 Elm Terrace, Westfield at $1,050,000. Referred Brennans. Great clients.',
   ((DATE '2026-04-11' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2025-12-22' + v_shift) + TIME '11:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 09 Megan Slattery — seller, CLOSED (March)
  (c09, v_agent_id, 'Megan Slattery', 'megan.slattery@gmail.com', '+12015550109',
   'manual', 'closed', 10, 'seller',
   'Englewood', NULL, false,
   NULL, NULL, NULL, NULL, 10, 0, 0.5,
   'CLOSED Mar 21 — listed 44 Glenwood Ave, Englewood. Sold for $810K ($25K over ask). 11 days on market.',
   ((DATE '2026-03-21' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2025-12-28' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 10 Robert & Amy DeSantis — buyers, Tenafly, CLOSED (May)
  (c10, v_agent_id, 'Robert & Amy DeSantis', 'r.desantis@gmail.com', '+12015550110',
   'zillow', 'closed', 10, 'buyer',
   'Tenafly', ARRAY['Tenafly','Cresskill'], false,
   1100000, 1400000, 5, 3.5, 5, 0, 0.5,
   'CLOSED May 2 — 29 Alpine Rd, Tenafly at $1,275,000. Smooth transaction. Will refer friends.',
   ((DATE '2026-05-02' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2025-12-30' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 11 Janet Kowalski — seller, Tenafly, listing active
  (c11, v_agent_id, 'Janet Kowalski', 'jkowalski55@gmail.com', '+12015550111',
   'manual', 'showing', 7, 'seller',
   'Tenafly', NULL, false,
   NULL, NULL, NULL, NULL, 10, 0, 0.5,
   'Listing 82 Prospect St, Tenafly at $1,195,000. Widowed, downsizing. Emotional process — be patient.',
   ((DATE '2026-06-19' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-03-10' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC', NULL, (CURRENT_DATE - INTERVAL '39 years')::date),

  -- 12 Phil & Gwen Harrington — sellers, Ridgewood, pre-listing
  (c12, v_agent_id, 'Phil & Gwen Harrington', 'phil.harrington@gmail.com', '+12015550112',
   'referral', 'contacted', 6, 'seller',
   'Ridgewood', NULL, false,
   NULL, NULL, NULL, NULL, 10, 0, 0.5,
   'Want to list in fall. 4BR colonial on 0.4 acres. Getting estimates — meeting with 2 other agents.',
   ((DATE '2026-06-10' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-05-20' + v_shift) + TIME '11:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 13 Thomas Nguyen — seller, Fort Lee, UNDER CONTRACT
  (c13, v_agent_id, 'Thomas Nguyen', 'thomas.nguyen@gmail.com', '+12015550113',
   'manual', 'under_contract', 8, 'seller',
   'Fort Lee', NULL, false,
   NULL, NULL, NULL, NULL, 10, 0, 0.5,
   'Listed 308 Anderson Ave, Fort Lee at $849K. Under contract at $861K. Closing July 14.',
   ((DATE '2026-06-20' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-03-25' + v_shift) + TIME '09:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 14 Carol & Bob Ostrowski — sellers, Summit, showings active
  (c14, v_agent_id, 'Carol & Bob Ostrowski', 'carol.ostrowski@gmail.com', '+19085550114',
   'manual', 'showing', 7, 'seller',
   'Summit', NULL, false,
   NULL, NULL, NULL, NULL, 10, 0, 0.5,
   'Listed 17 Summit Crest Dr at $875K. 3 showings so far — getting feedback that kitchen is dated.',
   ((DATE '2026-06-21' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-04-15' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC', NULL, (CURRENT_DATE + 9 - INTERVAL '31 years')::date),

  -- 15 Diana Fenton — seller, Paramus, pre-listing
  (c15, v_agent_id, 'Diana Fenton', 'dfenton@hotmail.com', '+12015550115',
   'manual', 'contacted', 5, 'seller',
   'Paramus', NULL, false,
   NULL, NULL, NULL, NULL, 10, 0, 0.5,
   'Inherited property. Needs estate attorney to clear title first. Circle back August.',
   ((DATE '2026-06-05' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-05-28' + v_shift) + TIME '11:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 16 Daniel & Sofia Moretti — buyers, Fort Lee, active nurture
  (c16, v_agent_id, 'Daniel & Sofia Moretti', 'dmoretti@gmail.com', '+12015550116',
   'referral', 'contacted', 7, 'buyer',
   'Fort Lee', ARRAY['Fort Lee','Palisades Park','Ridgefield'], true,
   850000, 1100000, 4, 2.5, 10, 1, 0.5,
   'Relocating from San Francisco. Remote workers, need home office. Pre-approval in progress.',
   ((DATE '2026-06-16' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 3,
   ((DATE '2026-04-05' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 17 Kevin Okafor — buyer, Paramus, nurture
  (c17, v_agent_id, 'Kevin Okafor', 'k.okafor@gmail.com', '+12015550117',
   'zillow', 'contacted', 6, 'buyer',
   'Paramus', ARRAY['Paramus','Rochelle Park','Hackensack'], true,
   600000, 750000, 3, 2.0, 10, 1, 0.5,
   'First-time buyer. Getting pre-approval through Chase. Wants newer construction or fully updated.',
   ((DATE '2026-06-14' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC', 2,
   ((DATE '2026-04-20' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC', (CURRENT_DATE + 12 - INTERVAL '29 years')::date, NULL),

  -- 18 Chris Nakamura — buyer, Summit, nurture
  (c18, v_agent_id, 'Chris Nakamura', 'chris.nakamura@gmail.com', '+19085550118',
   'google', 'contacted', 6, 'buyer',
   'Summit', ARRAY['Summit','Chatham','Madison'], true,
   1100000, 1400000, 4, 3.0, 10, 1, 0.5,
   'Executive at pharma company in Florham Park. Short commute a must. Prefers turnkey — no projects.',
   ((DATE '2026-06-12' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', 1,
   ((DATE '2026-04-28' + v_shift) + TIME '11:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 19 Victor Reyes — buyer, Fort Lee, nurture
  (c19, v_agent_id, 'Victor Reyes', 'victor.reyes@gmail.com', '+12015550119',
   'zillow', 'contacted', 5, 'buyer',
   'Fort Lee', ARRAY['Fort Lee','North Bergen','Guttenberg'], true,
   550000, 680000, 2, 2.0, 15, 1, 1.0,
   'Single buyer, flexible. Looking at condos vs townhouses. Pre-approved $650K.',
   ((DATE '2026-06-08' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 4,
   ((DATE '2026-05-05' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 20 Veronica & Paul Caruso — buyers, Summit, slow nurture
  (c20, v_agent_id, 'Veronica & Paul Caruso', 'paul.caruso@gmail.com', '+19085550120',
   'referral', 'contacted', 5, 'buyer',
   'Summit', ARRAY['Summit','Westfield','Millburn'], true,
   800000, 950000, 4, 2.5, 10, 1, 0.5,
   'Not ready until kids are out of current school — targeting next spring. Keep warm.',
   ((DATE '2026-06-01' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC', 2,
   ((DATE '2026-05-10' + v_shift) + TIME '11:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 21 Stephanie Walsh — buyer, Tenafly, new lead
  (c21, v_agent_id, 'Stephanie Walsh', 'stephanie.walsh@gmail.com', '+12015550121',
   'zillow', 'new', 4, 'buyer',
   'Tenafly', ARRAY['Tenafly','Cresskill','Demarest'], true,
   700000, 850000, 3, 2.0, 10, 1, 0.5,
   'Just submitted Zillow inquiry. Responded same day. Needs pre-approval.',
   ((DATE '2026-06-21' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-06-21' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 22 Jessica Bloom — buyer, Paramus, new lead
  (c22, v_agent_id, 'Jessica Bloom', 'jbloom87@gmail.com', '+12015550122',
   'google', 'new', 3, 'buyer',
   'Paramus', ARRAY['Paramus','Fair Lawn','Glen Rock'], true,
   575000, 700000, 3, 2.0, 15, 1, 1.0,
   'Google ad click — emailed for info. First-time buyer, researching neighborhoods.',
   ((DATE '2026-06-20' + v_shift) + TIME '21:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-06-20' + v_shift) + TIME '21:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 23 Tyler & Nicole Chambers — buyers, Westfield, new lead
  (c23, v_agent_id, 'Tyler & Nicole Chambers', 'tyler.chambers@gmail.com', '+19085550123',
   'referral', 'new', 4, 'buyer',
   'Westfield', ARRAY['Westfield','Scotch Plains','Fanwood'], true,
   900000, 1100000, 4, 2.5, 10, 1, 0.5,
   'Referral from Patel family. Reaching out this week to set intro call.',
   ((DATE '2026-06-22' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-06-22' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 24 Grace Liu — buyer, Englewood, new lead
  (c24, v_agent_id, 'Grace Liu', 'grace.liu@gmail.com', '+12015550124',
   'referral', 'new', 3, 'buyer',
   'Englewood', ARRAY['Englewood','Leonia','Teaneck'], true,
   650000, 800000, 3, 2.0, 10, 1, 0.5,
   'Instagram DM — saw 44 Glenwood listing (now sold). Wants something similar.',
   ((DATE '2026-06-21' + v_shift) + TIME '22:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-06-21' + v_shift) + TIME '22:00:00') AT TIME ZONE 'UTC', NULL, NULL),

  -- 25 Sean Fitzpatrick — buyer, Tenafly, brand-new cold
  (c25, v_agent_id, 'Sean Fitzpatrick', 'sfitz@gmail.com', '+12015550125',
   'zillow', 'new', 2, 'buyer',
   'Tenafly', ARRAY['Tenafly','Alpine','Cresskill'], true,
   950000, 1200000, 4, 3.0, 10, 1, 0.5,
   'Inquired on Zillow this morning. No response yet — call today.',
   ((DATE '2026-06-22' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', 0,
   ((DATE '2026-06-22' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', NULL, NULL);


  -- ===========================================================================
  -- PROPERTIES (11 — mix of active, sold, pending)
  -- ===========================================================================
  INSERT INTO public.properties (
    id, agent_id, address, town, price, beds, baths, sqft,
    description, mls_number, status, property_type, photos, created_at
  ) VALUES

  (p01, v_agent_id, '18 Birchwood Dr, Tenafly', 'Tenafly', 1350000, 5, 3.5, 3800,
   'Stone-front colonial on a cul-de-sac. Updated kitchen, finished basement, 3-car garage.',
   'MLS-TEN-2026-0418', 'available', 'single_family', '[]', ((DATE '2026-04-18' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (p02, v_agent_id, '94 Palisade Ave, Englewood', 'Englewood', 799000, 3, 2.0, 2100,
   'Bright Cape Cod, fully renovated. Chef''s kitchen, hardwood floors, detached garage.',
   'MLS-ENG-2026-0301', 'available', 'single_family', '[]', ((DATE '2026-03-01' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (p03, v_agent_id, '210 Hillcrest Rd, Ridgewood', 'Ridgewood', 975000, 4, 2.5, 2850,
   'Classic center-hall colonial. 4 bedrooms, large yard, great school district.',
   'MLS-RID-2026-0520', 'available', 'single_family', '[]', ((DATE '2026-05-20' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (p04, v_agent_id, '7 Orchard Ln, Westfield', 'Westfield', 929000, 4, 2.5, 2700,
   'Move-in ready Westfield colonial. Close to downtown and train. Fenced backyard.',
   'MLS-WES-2026-0430', 'available', 'single_family', '[]', ((DATE '2026-04-30' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (p05, v_agent_id, '55 Linwood Ave, Fort Lee', 'Fort Lee', 899000, 4, 2.5, 2650,
   'Expanded split-level. Updated baths, home office, steps from GWB bus to NYC.',
   'MLS-FTL-2026-0510', 'available', 'single_family', '[]', ((DATE '2026-05-10' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (p06, v_agent_id, '33 River Rd, Ridgewood', 'Ridgewood', 849000, 3, 2.0, 2200,
   'Charming Tudor with updated kitchen. Quiet street, close to village shops and train.',
   'MLS-RID-2026-0215', 'pending', 'single_family', '[]', ((DATE '2026-02-15' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (p07, v_agent_id, '12 Harbor View Ct, Fort Lee', 'Fort Lee', 999000, 4, 2.5, 3100,
   'End-unit townhouse with Hudson River views. Gated community, 2-car garage.',
   'MLS-FTL-2026-0201', 'pending', 'single_family', '[]', ((DATE '2026-02-01' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (p08, v_agent_id, '6 Elm Terrace, Westfield', 'Westfield', 1050000, 4, 2.5, 3000,
   'Classic Victorian in top Westfield school zone. Wraparound porch, double-car garage.',
   'MLS-WES-2025-1210', 'sold', 'single_family', '[]', ((DATE '2025-12-10' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (p09, v_agent_id, '44 Glenwood Ave, Englewood', 'Englewood', 785000, 3, 2.0, 2050,
   'Gut-renovated bungalow. New everything — roof, HVAC, kitchen, baths. Move-in ready.',
   'MLS-ENG-2025-1215', 'sold', 'single_family', '[]', ((DATE '2025-12-15' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (p10, v_agent_id, '29 Alpine Rd, Tenafly', 'Tenafly', 1275000, 5, 3.5, 4100,
   'Grand colonial on .6-acre lot. Chef''s kitchen, 3-car garage, pool. Top-rated schools.',
   'MLS-TEN-2025-1220', 'sold', 'single_family', '[]', ((DATE '2025-12-20' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (p11, v_agent_id, '17 Summit Crest Dr, Summit', 'Summit', 875000, 4, 2.5, 2650,
   'Well-maintained Tudor, great bones. Kitchen needs updating. Desirable Summit location.',
   'MLS-SUM-2026-0505', 'available', 'single_family', '[]', ((DATE '2026-05-05' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Fresh listings added specifically to drive today's new-MLS-match cards (see PROPERTY MATCHES below)
  (p12, v_agent_id, '23 Fairview Ave, Paramus', 'Paramus', 685000, 3, 2.0, 1950,
   'Updated split-level near downtown Paramus. New roof, refinished floors, 2-car driveway.',
   'MLS-PAR-2026-NEW1', 'available', 'single_family', '[]', (v_today + TIME '09:00:00') AT TIME ZONE 'UTC'),

  (p13, v_agent_id, '8 Terrace Way, Fort Lee', 'Fort Lee', 625000, 2, 2.0, 1400,
   'Low-maintenance townhouse, garage parking, minutes to the GWB bus.',
   'MLS-FTL-2026-NEW2', 'available', 'single_family', '[]', (v_today + TIME '09:15:00') AT TIME ZONE 'UTC');


  -- ===========================================================================
  -- LISTINGS (agent's OWN listings — 3)
  -- ===========================================================================
  INSERT INTO public.listings (
    id, agent_id, address, price, beds, baths, sqft,
    description, mls_description, instagram_captions, sms_blast,
    photos, view_count, is_featured, created_at
  ) VALUES

  -- Sold listing (Megan's)
  (l01, v_agent_id, '44 Glenwood Ave, Englewood, NJ', 785000, 3, 2.0, 2050,
   'Gut-renovated bungalow in sought-after Englewood. New roof, HVAC, kitchen, and baths.',
   'Turnkey 3BR/2BA in Englewood — fully renovated 2025. Hardwood floors, quartz counters, primary suite with walk-in. Close to NYC transit. Nothing to do but move in.',
   '{"funny": "When the house is so renovated even the ghosts moved out. 👻 44 Glenwood Ave is HERE 🔑", "professional": "New listing: 44 Glenwood Ave, Englewood. 3BR/2BA, fully gut-renovated. $785,000. Link in bio.", "teaser": "Something special just hit the Englewood market… 👀 Stay tuned."}',
   '🏡 NEW: 44 Glenwood Ave, Englewood — fully renovated 3BR at $785K! Reply for a showing.',
   '[]', 187, false, ((DATE '2025-12-28' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Active listing (Janet's)
  (l02, v_agent_id, '82 Prospect St, Tenafly, NJ', 1195000, 4, 3.0, 3400,
   'Gracious Tenafly colonial on .45 acres. Updated kitchen, 3-car garage, top school district.',
   'Exceptional 4BR/3BA colonial in premier Tenafly location. Renovated chef''s kitchen with SubZero/Wolf. Primary suite with spa bath. Three-car attached garage. .45-acre level yard. Award-winning Tenafly schools.',
   '{"funny": "Big house energy — because storage should never be a personality trait. 82 Prospect St, Tenafly 🏡", "professional": "Just listed: 82 Prospect St, Tenafly. 4BR/3BA colonial, $1,195,000. Top schools, stunning details.", "teaser": "Tenafly just got a listing that checks every box 📋 Details coming shortly…"}',
   '🏡 JUST LISTED: 82 Prospect St, Tenafly — 4BR colonial at $1,195,000! DM for private showing.',
   '[]', 94, true, ((DATE '2026-03-10' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Under contract listing (Thomas's)
  (l03, v_agent_id, '308 Anderson Ave, Fort Lee, NJ', 849000, 3, 2.5, 2400,
   'Expanded bi-level in prime Fort Lee location. Updated throughout. Minutes to GWB.',
   'Stunning 3BR/2.5BA bi-level completely updated. Open-concept living, gourmet kitchen, primary suite addition. NYC commuter''s dream — GWB 5 minutes. Under contract.',
   '{"funny": "Fort Lee called — it wants you to stop renting. 308 Anderson Ave is the one. 🌉", "professional": "Under contract: 308 Anderson Ave, Fort Lee. 3BR/2.5BA, $849,000. 12 days to contract!", "teaser": "UNDER CONTRACT in 12 days 🎉 Fort Lee market is 🔥"}',
   '🎉 UNDER CONTRACT — 308 Anderson Ave, Fort Lee sold in 12 days! Selling soon? Call Sarah.',
   '[]', 143, false, ((DATE '2026-03-25' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC');


  -- ===========================================================================
  -- TRANSACTIONS (4 active/recent)
  -- ===========================================================================
  INSERT INTO public.transactions (
    client_id, agent_id, address, contract_price, closing_date,
    inspection_date, appraisal_date, mortgage_commitment_date,
    attorney_name, attorney_email, lender_name, lender_email,
    status, notes, created_at
  ) VALUES

  -- Yuki Tanaka — under contract, closing in 2 days (all 4 milestones overridden
  -- together so they stay chronological: inspection/appraisal/mortgage commitment
  -- all land before the closing_date that triggers the "closing at risk" card)
  (c06, v_agent_id, '33 River Rd, Ridgewood, NJ', 872000,
   ((v_today + 2) + TIME '16:00:00') AT TIME ZONE 'UTC', ((v_today - 12) + TIME '13:00:00') AT TIME ZONE 'UTC', ((v_today - 4) + TIME '14:00:00') AT TIME ZONE 'UTC', ((v_today - 1) + TIME '14:00:00') AT TIME ZONE 'UTC',
   'Howard Stern, Esq.', 'hstern@bergenlaw.com', 'Garden State Mortgage', 'loans@gsmortgage.com',
   'active', 'Offer accepted Jun 10. Inspection completed Jun 16 — minor items, seller crediting $3K. Appraisal Jun 24. Clear-to-close targeted Jul 7.',
   ((DATE '2026-06-10' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),

  -- Omar & Layla Hassan — under contract, closing July 10
  (c07, v_agent_id, '12 Harbor View Ct, Fort Lee, NJ', 995000,
   ((DATE '2026-07-10' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', ((DATE '2026-06-09' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', ((DATE '2026-06-20' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC', ((DATE '2026-06-30' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC',
   'Linda Park, Esq.', 'lpark@parklaw.com', 'Cross County Federal CU', 'mortgages@ccfcu.org',
   'active', 'Offer accepted Jun 2. Inspection Jun 9 — all clear. Appraisal came in at value Jun 20. Waiting on mortgage commitment.',
   ((DATE '2026-06-02' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),

  -- Alex & Nadia Goldstein — CLOSED April 11
  (c08, v_agent_id, '6 Elm Terrace, Westfield, NJ', 1050000,
   ((DATE '2026-04-11' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', ((DATE '2026-03-25' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', ((DATE '2026-03-28' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC', ((DATE '2026-04-02' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC',
   'Richard Marks, Esq.', 'rmarks@markslaw.com', 'Provident Bank', 'mortgages@provident.com',
   'closed', 'Smooth transaction. Closed on time. Referral source: direct relationship. Referred Brennans at closing.',
   ((DATE '2026-03-12' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),

  -- Robert & Amy DeSantis — CLOSED May 2
  (c10, v_agent_id, '29 Alpine Rd, Tenafly, NJ', 1275000,
   ((DATE '2026-05-02' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', ((DATE '2026-04-15' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', ((DATE '2026-04-18' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC', ((DATE '2026-04-25' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC',
   'Susan Berg, Esq.', 'sberg@bergcounselors.com', 'Wells Fargo Home', 'nj.mortgages@wellsfargo.com',
   'closed', 'Multiple offer situation — won at $25K over ask, escalation clause. Smooth close. DeSantis family moving from Closter.',
   ((DATE '2026-04-03' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC');


  -- ===========================================================================
  -- ACTIVITIES — detailed per-client timeline
  -- ===========================================================================
  INSERT INTO public.activities (client_id, agent_id, type, body, ai_draft, approved, sent, direction, created_at)
  VALUES

  -- ---- Marcus & Jen Holloway (c01) — Hot buyer, Tenafly ----
  (c01, v_agent_id, 'note', 'Marcus called from Zillow lead. Pre-approved $1.4M through TD Bank. Wants to stay in Tenafly district — daughter is a sophomore at THS. Available weekends.', false, false, false, 'outbound', ((DATE '2025-12-29' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'call', 'Intro call — 22 min. Discussed Tenafly market, price trends. Explained my process. They''ve toured 2 homes with another agent but weren''t impressed. Sending listings tonight.', false, false, false, 'outbound', ((DATE '2025-12-30' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'text', 'Hi Marcus! Great speaking today. Here are 3 Tenafly listings I''m watching that match your criteria. Let me know which you''d like to tour! — Sarah', false, false, true, 'outbound', ((DATE '2025-12-30' + v_shift) + TIME '16:30:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'text', 'Thanks Sarah! We like 18 Birchwood and the one on Alpine. Can we see them Saturday?', false, false, false, 'inbound', ((DATE '2025-12-31' + v_shift) + TIME '09:00:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'showing', 'Toured 18 Birchwood Dr — Marcus loved the cul-de-sac and 3-car garage. Jen wants to see more kitchens. Not ready to offer yet.', false, false, false, 'outbound', ((DATE '2026-01-04' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'note', 'Followed up Jan 5. They toured a Cresskill home with another agent — didn''t like the neighborhood. Still focused on Tenafly.', false, false, false, 'outbound', ((DATE '2026-01-05' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'text', 'Marcus — 29 Alpine Rd just went pending but 18 Birchwood is still available. Worth a second look before more competition hits. When can you go back?', false, false, true, 'outbound', ((DATE '2026-03-05' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'text', 'Sarah you''re right, let''s do it. Saturday morning works. Also can you pull comps for Birchwood?', false, false, false, 'inbound', ((DATE '2026-03-05' + v_shift) + TIME '15:30:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'showing', 'Second tour of 18 Birchwood. Much more engaged this time — Jen loved the renovated kitchen and primary suite. Marcus measured the garage. Very close to offering.', false, false, false, 'outbound', ((DATE '2026-03-08' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'call', 'CMA call — reviewed comps. 18 Birchwood listed $1.35M, comparables support $1.3-1.38M. Discussed offer strategy. They want to sleep on it.', false, false, false, 'outbound', ((DATE '2026-03-10' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'text', 'Hi Marcus — checking in. 18 Birchwood had 2 showings this week. Strong interest from other buyers. Happy to talk strategy anytime this week.', false, false, true, 'outbound', ((DATE '2026-05-15' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'showing', 'Third Birchwood tour — brought inspector friend informally. House is solid. Marcus ready to offer at $1.32M. Writing this weekend.', false, false, false, 'outbound', ((DATE '2026-06-14' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'call', 'Offer strategy call. Listing is at $1.35M with 2 other showing appointments this week. Recommended $1.33M with escalation to $1.375M. They agreed.', false, false, false, 'outbound', ((DATE '2026-06-18' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'text', 'Sarah the offer is ready to sign — Jen and I reviewed it. Sending back tonight.', false, false, false, 'inbound', ((DATE '2026-06-20' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),

  -- ---- Rachel Kim (c02) — buyer, Englewood ----
  (c02, v_agent_id, 'note', 'Rachel found me through Google. Single professional, commutes to NYC. Wants walkable Englewood, pre-approved $825K through Chase.', false, false, false, 'outbound', ((DATE '2026-01-07' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c02, v_agent_id, 'text', 'Hi Rachel, this is Sarah Levine! Thanks for reaching out. I''d love to learn more about what you''re looking for in Englewood. Are you free for a quick call this week?', false, false, true, 'outbound', ((DATE '2026-01-07' + v_shift) + TIME '15:30:00') AT TIME ZONE 'UTC'),
  (c02, v_agent_id, 'text', 'Hi Sarah! Yes, how about Thursday at 7pm?', false, false, false, 'inbound', ((DATE '2026-01-07' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c02, v_agent_id, 'call', '30-min intro call. Discussed Englewood neighborhoods — prefers east side near downtown. Budget $825K firm. Needs parking (no garage required). Wants to start touring in Feb.', false, false, false, 'outbound', ((DATE '2026-01-09' + v_shift) + TIME '23:00:00') AT TIME ZONE 'UTC'),
  (c02, v_agent_id, 'showing', 'Toured 44 Glenwood Ave (my listing) and 2 others on Palisade Ave. Loved Glenwood — worried about street noise.', false, false, false, 'outbound', ((DATE '2026-02-08' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c02, v_agent_id, 'note', 'Rachel passed on Glenwood — went under contract anyway (Megan''s buyer). Refocusing on Palisade Ave comps.', false, false, false, 'outbound', ((DATE '2026-03-01' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (c02, v_agent_id, 'text', 'Rachel — 94 Palisade just came on at $799K. Fully renovated, 3BR/2BA, detached garage. This could be the one. Want to see it Saturday?', false, false, true, 'outbound', ((DATE '2026-06-10' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),
  (c02, v_agent_id, 'text', 'YES. Saturday at 11 works perfectly!', false, false, false, 'inbound', ((DATE '2026-06-10' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),
  (c02, v_agent_id, 'showing', 'Toured 94 Palisade Ave. Rachel was very impressed — loved the kitchen and the block. Asked about the neighbors. Requesting disclosure docs.', false, false, false, 'outbound', ((DATE '2026-06-14' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c02, v_agent_id, 'call', 'Post-tour call. She''s excited. Reviewed comps — $799K is fair. Discussed offer strategy. She wants to think overnight.', false, false, false, 'outbound', ((DATE '2026-06-14' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),
  (c02, v_agent_id, 'text', 'Sarah I keep thinking about it. Let''s write the offer. Can we do $800K with $5K escalation to $825K?', false, false, false, 'inbound', ((DATE '2026-06-19' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),

  -- ---- Amanda & Tom Brennan (c03) — buyer, Ridgewood ----
  (c03, v_agent_id, 'note', 'Referral from Goldstein family. Alex called to introduce them. Brennans have 2 kids, looking for top Ridgewood schools. Budget $1.05M pre-approved.', false, false, false, 'outbound', ((DATE '2026-02-14' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c03, v_agent_id, 'call', 'Intro call with Amanda — very warm, mentioned Alex and Nadia highly recommended me. Wants center-hall colonial. Must be on the east side of Ridgewood for Willard school zone.', false, false, false, 'outbound', ((DATE '2026-02-14' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c03, v_agent_id, 'text', 'Amanda & Tom — so glad to connect! I''ll start pulling Willard zone listings this week. Excited to find you the perfect Ridgewood home.', false, false, true, 'outbound', ((DATE '2026-02-14' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC'),
  (c03, v_agent_id, 'showing', 'Toured 3 Ridgewood colonials. Brennans liked 210 Hillcrest best — layout works, good yard. Pricing just above their comfort at $975K.', false, false, false, 'outbound', ((DATE '2026-04-12' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c03, v_agent_id, 'note', 'Price reduction conversation — Hillcrest has been sitting 45 days. Sellers may be open. Will reach out to listing agent.', false, false, false, 'outbound', ((DATE '2026-05-20' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (c03, v_agent_id, 'call', 'Reached listing agent — seller will consider offers starting $950K. Bringing Brennans back for second look.', false, false, false, 'outbound', ((DATE '2026-06-05' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),
  (c03, v_agent_id, 'showing', 'Second tour of 210 Hillcrest. Tom brought a contractor friend — estimated $30K for kitchen refresh. They''re warming up. Amanda loves the yard.', false, false, false, 'outbound', ((DATE '2026-06-15' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c03, v_agent_id, 'text', 'Tom — based on your contractor visit and the 45 days on market, I think $945K is the right opening number. Seller has motivation. Want to move forward?', false, false, true, 'outbound', ((DATE '2026-06-21' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),
  (c03, v_agent_id, 'text', 'Amanda and I talked — YES. Let''s write it up. Can you send the offer worksheet tonight?', false, false, false, 'inbound', ((DATE '2026-06-21' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),

  -- ---- Priya & Raj Patel (c04) — buyer, Westfield ----
  (c04, v_agent_id, 'note', 'Zillow lead. Relocating from Edison — Raj''s parents will live with them, so 4BR minimum. Priya wants a finished basement for a home gym. Pre-approved $975K.', false, false, false, 'outbound', ((DATE '2026-01-22' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),
  (c04, v_agent_id, 'text', 'Hi Priya! Welcome — I received your Zillow inquiry. I know Westfield very well and I''d love to help you find the right home for your family. Can we chat this week?', false, false, true, 'outbound', ((DATE '2026-01-22' + v_shift) + TIME '14:30:00') AT TIME ZONE 'UTC'),
  (c04, v_agent_id, 'call', 'Intro call — 25 min. Raj joined. Must have in-law suite or finished basement. Want a flat yard for family gatherings. Flexible on close (Raj''s job starts Sept 1).', false, false, false, 'outbound', ((DATE '2026-01-24' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c04, v_agent_id, 'showing', 'Toured 3 Westfield and Cranford homes. None had the right basement layout. Will expand search slightly.', false, false, false, 'outbound', ((DATE '2026-03-15' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c04, v_agent_id, 'showing', 'Toured 7 Orchard Ln, Westfield ($929K). Raj loved the finished basement and flat yard. Priya noted dated primary bath but liked the size. Good candidate.', false, false, false, 'outbound', ((DATE '2026-06-07' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c04, v_agent_id, 'call', 'Follow-up on Orchard Ln. Raj is ready to move but Priya wants to see one more. Scheduling second Orchard tour plus 1 new listing this weekend.', false, false, false, 'outbound', ((DATE '2026-06-10' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),
  (c04, v_agent_id, 'text', 'Raj — Orchard Ln has a showing appointment tomorrow. If you''re close to deciding I''d recommend we move soon. Happy to answer any questions tonight.', false, false, true, 'outbound', ((DATE '2026-06-18' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),
  (c04, v_agent_id, 'text', 'Sarah we are ready! Priya convinced. Let''s see it one more time Sunday then write.', false, false, false, 'inbound', ((DATE '2026-06-18' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),

  -- ---- Brian & Kelly McGrath (c05) — buyer, Englewood ----
  (c05, v_agent_id, 'note', 'Instagram inquiry — saw one of my Englewood posts. Upgrading from Fort Lee condo. Kelly needs a dedicated home office and mudroom. Pre-approved $1.15M.', false, false, false, 'outbound', ((DATE '2026-03-01' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),
  (c05, v_agent_id, 'call', 'Intro call — great energy. Both are in finance, flexible schedule. Looking at Englewood, Tenafly, Cresskill. Want something move-in ready, no major projects.', false, false, false, 'outbound', ((DATE '2026-03-03' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c05, v_agent_id, 'showing', 'Toured 4 homes: 3 Englewood, 1 Cresskill. McGraths liked the Cresskill home most but it''s $1.25M, above budget. Monitoring for price drop.', false, false, false, 'outbound', ((DATE '2026-04-05' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c05, v_agent_id, 'showing', 'Toured 18 Birchwood, Tenafly (also showing Marcus). McGraths are interested — but so are the Holloways. Would need to move fast. Discussing tonight.', false, false, false, 'outbound', ((DATE '2026-05-10' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c05, v_agent_id, 'note', 'McGraths passed on Birchwood — too far from their gym and friends. Refocusing on Englewood/Tenafly border.', false, false, false, 'outbound', ((DATE '2026-05-12' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (c05, v_agent_id, 'text', 'Brian — 94 Palisade just listed but I have a pocket listing in Englewood that might be perfect for you and Kelly. Home office + mudroom exactly. Can I set up a private showing?', false, false, true, 'outbound', ((DATE '2026-06-17' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),
  (c05, v_agent_id, 'text', 'Sarah that sounds great! Kelly is available Friday afternoon.', false, false, false, 'inbound', ((DATE '2026-06-17' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),

  -- ---- Yuki Tanaka (c06) — buyer, UNDER CONTRACT ----
  (c06, v_agent_id, 'note', 'Google lead. Single professional moving from Jersey City. Wants Ridgewood for the vibe and commute to Hackensack hospital where she''s a radiologist.', false, false, false, 'outbound', ((DATE '2026-02-03' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),
  (c06, v_agent_id, 'call', 'Intro call — direct and decisive. Knows exactly what she wants: 3BR, 2BA, no fixer-uppers, under $900K, must have parking. Pre-approved $875K. Will move fast when right house appears.', false, false, false, 'outbound', ((DATE '2026-02-04' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c06, v_agent_id, 'showing', 'Toured 3 Ridgewood homes. Yuki is methodical — rated each on a spreadsheet. 33 River Rd scored highest on her criteria.', false, false, false, 'outbound', ((DATE '2026-03-22' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c06, v_agent_id, 'showing', 'Second look at 33 River Rd. She measured every room, took 200 photos. Wants to make an offer.', false, false, false, 'outbound', ((DATE '2026-04-05' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),
  (c06, v_agent_id, 'note', 'Offer submitted at $855K. Competing offer at $860K. Escalated to $872K with appraisal waiver to $865K. Accepted Jun 10!', false, false, false, 'outbound', ((DATE '2026-06-09' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC'),
  (c06, v_agent_id, 'text', 'YUKI! Offer accepted at $872,000! Congratulations — 33 River Rd is yours! Inspection is scheduled for Monday the 16th at 1pm. 🎉', false, false, true, 'outbound', ((DATE '2026-06-10' + v_shift) + TIME '21:00:00') AT TIME ZONE 'UTC'),
  (c06, v_agent_id, 'text', 'OH MY GOD. I can''t believe it!! Thank you Sarah! I''ll be at the inspection for sure.', false, false, false, 'inbound', ((DATE '2026-06-10' + v_shift) + TIME '21:30:00') AT TIME ZONE 'UTC'),
  (c06, v_agent_id, 'note', 'Inspection completed Jun 16. Inspector found minor items — seller agreed to $3K credit. Appraisal scheduled Jun 24. On track for July 18 close.', false, false, false, 'outbound', ((DATE '2026-06-16' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c06, v_agent_id, 'call', 'Appraisal prep call — reviewed what appraiser will look at. Confirmed Jun 24 appt. Discussed final walkthrough logistics for the week before closing.', false, false, false, 'outbound', ((DATE '2026-06-21' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),

  -- ---- Omar & Layla Hassan (c07) — buyer, UNDER CONTRACT ----
  (c07, v_agent_id, 'note', 'Referral from Farid Hassan (Omar''s cousin, past client 2023). Family of 4. Omar works in Manhattan, Layla is a teacher in Fort Lee. Must be near GWB.', false, false, false, 'outbound', ((DATE '2026-01-15' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c07, v_agent_id, 'call', 'Intro call with Omar and Layla. Very motivated — currently renting at $5,200/mo. Pre-approved $1.025M through CCFCU. Need 4BR for home office + kids'' rooms. Timeline: summer move.', false, false, false, 'outbound', ((DATE '2026-01-17' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c07, v_agent_id, 'showing', 'Toured 5 properties in Fort Lee and Edgewater. Hassans liked 12 Harbor View Ct most — views, layout, gated community. Sticker shock at $999K.', false, false, false, 'outbound', ((DATE '2026-03-08' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c07, v_agent_id, 'showing', 'Back to 12 Harbor View. Omar brought his father. Everyone loved it. Ran comps — market supports list price given views and HOA amenities.', false, false, false, 'outbound', ((DATE '2026-04-20' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c07, v_agent_id, 'call', 'Offer strategy call. Listed $999K, I recommend $985K with 60-day close and no contingencies beyond inspection. They agreed.', false, false, false, 'outbound', ((DATE '2026-04-25' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),
  (c07, v_agent_id, 'note', 'First offer at $985K — rejected. Seller countered at $999K. After negotiation, agreed $995K with seller covering $5K closing costs. Executed Jun 2.', false, false, false, 'outbound', ((DATE '2026-06-02' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c07, v_agent_id, 'text', 'Omar & Layla — CONTRACT EXECUTED at $995,000! Inspection Jun 9, appraisal Jun 20. Closing July 10. This is HAPPENING! 🏡', false, false, true, 'outbound', ((DATE '2026-06-02' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC'),
  (c07, v_agent_id, 'text', 'Sarah we are SO happy. Layla is already planning the kitchen. Thank you for fighting for us!', false, false, false, 'inbound', ((DATE '2026-06-02' + v_shift) + TIME '21:00:00') AT TIME ZONE 'UTC'),
  (c07, v_agent_id, 'note', 'Inspection all clear Jun 9. Appraisal came in at value $996K on Jun 20 — wonderful news. Mortgage commitment expected Jun 30. On track.', false, false, false, 'outbound', ((DATE '2026-06-20' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),

  -- ---- Alex & Nadia Goldstein (c08) — buyer, CLOSED ----
  (c08, v_agent_id, 'note', 'Met at an open house I was hosting in Westfield Dec 22. Nadia loved 6 Elm Terrace but it wasn''t my listing. They want to stay in Westfield, 4BR, top schools.', false, false, false, 'outbound', ((DATE '2025-12-22' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c08, v_agent_id, 'call', 'Holiday follow-up call. Very warm. Alex is an attorney, Nadia''s a pharmacist. Pre-approved $1.1M. Ready to move by spring so kids don''t change mid-year.', false, false, false, 'outbound', ((DATE '2025-12-26' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c08, v_agent_id, 'showing', 'Toured 3 Westfield homes in Jan. Goldsteins were most interested in 6 Elm Terrace (the one they loved at the open house) — it''s still on market.', false, false, false, 'outbound', ((DATE '2026-01-18' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c08, v_agent_id, 'note', 'Submitted offer $1,015K on Elm Terrace. Listed $1,050K. Multiple offer situation — sellers countered at list. Discussed options.', false, false, false, 'outbound', ((DATE '2026-02-20' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c08, v_agent_id, 'call', 'Escalated strategy call — recommended meeting at list to secure the house given competition. Goldsteins agreed. Revised offer at $1,050K, 45-day close.', false, false, false, 'outbound', ((DATE '2026-02-22' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c08, v_agent_id, 'note', 'CONTRACT EXECUTED Feb 23 at $1,050,000. Inspection Mar 25. Appraisal Mar 28. Mortgage commitment Apr 2. Closing Apr 11.', false, false, false, 'outbound', ((DATE '2026-02-23' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC'),
  (c08, v_agent_id, 'text', 'Alex & Nadia — you''re officially under contract! 🎉 Next step: I''ll send you our closing timeline checklist. Inspection Mar 25 at 9am.', false, false, true, 'outbound', ((DATE '2026-02-23' + v_shift) + TIME '20:30:00') AT TIME ZONE 'UTC'),
  (c08, v_agent_id, 'note', 'CLOSED Apr 11, 2026 at $1,050,000. Goldsteins were amazing clients. They referred the Brennan family at the closing table. 🏡', false, false, false, 'outbound', ((DATE '2026-04-11' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),

  -- ---- Megan Slattery (c09) — seller, CLOSED ----
  (c09, v_agent_id, 'note', 'Met Megan at a networking event Dec 28. She''s relocating to Florida and wants to sell 44 Glenwood Ave, Englewood. Property was gut renovated in 2025. Perfect listing opportunity.', false, false, false, 'outbound', ((DATE '2025-12-28' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC'),
  (c09, v_agent_id, 'call', 'Listing consultation — walked through the property virtually on FaceTime. Suggested $785K based on Englewood comps. Megan was hoping for more but agreed with my analysis.', false, false, false, 'outbound', ((DATE '2025-12-30' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c09, v_agent_id, 'note', 'LISTED Jan 3, 2026 at $785,000. Professional photos Jan 2. Launched on MLS same day. Immediate interest — 4 showings in first weekend.', false, false, false, 'outbound', ((DATE '2026-01-03' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (c09, v_agent_id, 'text', 'Megan — 4 showings this weekend and we already have a showing request for next Thursday! The house is showing beautifully. 🎉', false, false, true, 'outbound', ((DATE '2026-01-05' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),
  (c09, v_agent_id, 'note', 'OFFER RECEIVED Jan 14 — $810,000 ($25K over ask). Clean offer, 60-day close, conventional financing. Recommended acceptance. Megan thrilled.', false, false, false, 'outbound', ((DATE '2026-01-14' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),
  (c09, v_agent_id, 'text', 'MEGAN! We have an offer at $810,000 — $25K OVER asking! Clean terms. I think we take it. Call me?', false, false, true, 'outbound', ((DATE '2026-01-14' + v_shift) + TIME '18:30:00') AT TIME ZONE 'UTC'),
  (c09, v_agent_id, 'text', 'OH WOW. Yes yes yes! Calling you now!', false, false, false, 'inbound', ((DATE '2026-01-14' + v_shift) + TIME '18:45:00') AT TIME ZONE 'UTC'),
  (c09, v_agent_id, 'note', 'Under contract Jan 14. Inspection Jan 22 — minor issues, buyer gave credit. Clear to close Feb 28. Closing extended to Mar 21 at buyer request. Final walkthrough Mar 20.', false, false, false, 'outbound', ((DATE '2026-01-14' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC'),
  (c09, v_agent_id, 'note', 'CLOSED Mar 21 at $810,000. Megan cried happy tears. Moving to Sarasota next week. One of my cleanest transactions ever.', false, false, false, 'outbound', ((DATE '2026-03-21' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),

  -- ---- Robert & Amy DeSantis (c10) — buyer, CLOSED ----
  (c10, v_agent_id, 'note', 'Zillow inquiry Dec 30. Moving from Closter — want more space. 5BR for home office + guest room. Must stay in Bergen County for Robert''s commute to Paramus.', false, false, false, 'outbound', ((DATE '2025-12-30' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c10, v_agent_id, 'call', 'Intro call Jan 2. Very specific: Tenafly or Cresskill only, top school district, minimum 0.5 acre lot. Pre-approved $1.4M through Wells Fargo. Motivated.', false, false, false, 'outbound', ((DATE '2026-01-02' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c10, v_agent_id, 'showing', 'Toured 3 Tenafly colonials Feb 15. DeSantis family loved 29 Alpine Rd but listed at $1,275K with competition.', false, false, false, 'outbound', ((DATE '2026-02-15' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c10, v_agent_id, 'note', 'Multiple offer scenario at Alpine Rd. Recommended escalation clause $1,275K → $1,350K. DeSantis won at $1,275K — list price — because their escalation clause was highest.', false, false, false, 'outbound', ((DATE '2026-04-03' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC'),
  (c10, v_agent_id, 'text', 'Robert & Amy — YOUR OFFER WAS ACCEPTED! 29 Alpine Rd is yours at $1,275,000! Inspection Apr 15, closing May 2. SO excited for your family! 🏡🎉', false, false, true, 'outbound', ((DATE '2026-04-03' + v_shift) + TIME '21:00:00') AT TIME ZONE 'UTC'),
  (c10, v_agent_id, 'text', 'SARAH! We''re screaming!! Amy is in tears! Thank you, thank you, thank you!!!', false, false, false, 'inbound', ((DATE '2026-04-03' + v_shift) + TIME '21:30:00') AT TIME ZONE 'UTC'),
  (c10, v_agent_id, 'note', 'Smooth transaction. Inspection Apr 15 — minor items, seller repainted mudroom and credited $500. Appraisal Apr 18 at value. Closed May 2 as scheduled.', false, false, false, 'outbound', ((DATE '2026-05-02' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),

  -- ---- Janet Kowalski (c11) — seller, Tenafly active listing ----
  (c11, v_agent_id, 'note', 'Called me through a friend referral. Widowed last year, downsizing from 82 Prospect St. 4BR colonial. Emotional process — she raised her kids there. Needs patience.', false, false, false, 'outbound', ((DATE '2026-03-10' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c11, v_agent_id, 'call', 'In-home listing consultation Mar 12. Property is in great condition — Janet keeps it immaculate. Suggested $1,195K based on Tenafly comps. She wanted $1.3M but listened to market data.', false, false, false, 'outbound', ((DATE '2026-03-12' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c11, v_agent_id, 'note', 'LISTED Apr 2 at $1,195,000. Professional staging, drone photos. Beautiful listing.', false, false, false, 'outbound', ((DATE '2026-04-02' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (c11, v_agent_id, 'showing', '5 showings in April — positive feedback. Buyers love the kitchen and lot. Two said master bath is dated.', false, false, false, 'outbound', ((DATE '2026-04-30' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),
  (c11, v_agent_id, 'call', 'Monthly check-in with Janet. 47 days on market. Discussed price strategy — holding at $1,195K for now. Will reassess at 60 days.', false, false, false, 'outbound', ((DATE '2026-05-19' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),
  (c11, v_agent_id, 'text', 'Janet — we have showings scheduled for this Saturday at 11am and Sunday at 2pm. Two interested parties. Feeling positive! 🏡', false, false, true, 'outbound', ((DATE '2026-06-18' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (c11, v_agent_id, 'text', 'Thank you Sarah. I hope one of them is the right family for this house.', false, false, false, 'inbound', ((DATE '2026-06-18' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),
  (c11, v_agent_id, 'note', 'Showings Jun 21 — both couples expressed strong interest. Expecting feedback this week. May get an offer soon.', false, false, false, 'outbound', ((DATE '2026-06-21' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),

  -- ---- Phil & Gwen Harrington (c12) — seller, pre-listing ----
  (c12, v_agent_id, 'note', 'Referral from Tenafly neighbor. Want to downsize when youngest leaves for college in August. 4BR colonial on Ridgewood''s east side.', false, false, false, 'outbound', ((DATE '2026-05-20' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c12, v_agent_id, 'call', 'Intro call — Phil is analytical, wants market data. Sent CMA. They''re interviewing 3 agents. Follow up in June.', false, false, false, 'outbound', ((DATE '2026-05-22' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c12, v_agent_id, 'text', 'Phil & Gwen — I''ve put together an updated CMA for your neighborhood. Ridgewood colonials are moving quickly this spring. Love to chat about timing.', false, false, true, 'outbound', ((DATE '2026-06-10' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),
  (c12, v_agent_id, 'text', 'Thanks Sarah. We''re meeting with two other agents this week. We''ll be in touch.', false, false, false, 'inbound', ((DATE '2026-06-10' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),

  -- ---- Thomas Nguyen (c13) — seller, UNDER CONTRACT ----
  (c13, v_agent_id, 'note', 'Met at open house I hosted in Fort Lee. Thomas is selling his father''s property at 308 Anderson Ave. Estate sale, no emotional attachment — wants max price, fast sale.', false, false, false, 'outbound', ((DATE '2026-03-25' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),
  (c13, v_agent_id, 'note', 'LISTED Apr 15 at $849,000. Strong Fort Lee market. 3 showings in first week.', false, false, false, 'outbound', ((DATE '2026-04-15' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (c13, v_agent_id, 'text', 'Thomas — offer came in at $840K this afternoon! Conventional, 60-day close. Let me know when you can talk.', false, false, true, 'outbound', ((DATE '2026-04-27' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c13, v_agent_id, 'call', 'Reviewed offer. Thomas wants $865K. I recommended countering at $861K — split the difference, show good faith. He agreed.', false, false, false, 'outbound', ((DATE '2026-04-27' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),
  (c13, v_agent_id, 'note', 'CONTRACT EXECUTED Apr 28 at $861,000 — $12K over ask. Inspection May 5. Clean — seller agreed to fix dryer vent and nothing else. Appraisal May 12 at value. Closing July 14.', false, false, false, 'outbound', ((DATE '2026-04-28' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC'),
  (c13, v_agent_id, 'text', 'Thomas — we are UNDER CONTRACT at $861,000! Over asking! 🎉 Closing July 14. Everything looking smooth.', false, false, true, 'outbound', ((DATE '2026-04-28' + v_shift) + TIME '21:00:00') AT TIME ZONE 'UTC'),
  (c13, v_agent_id, 'text', 'Excellent work Sarah. My father would be pleased. Keep me posted.', false, false, false, 'inbound', ((DATE '2026-04-29' + v_shift) + TIME '08:00:00') AT TIME ZONE 'UTC'),
  (c13, v_agent_id, 'note', 'Appraisal May 12 at value. Final walkthrough scheduled Jul 11. On track for Jul 14 close.', false, false, false, 'outbound', ((DATE '2026-06-20' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),

  -- ---- Carol & Bob Ostrowski (c14) — seller, Summit active ----
  (c14, v_agent_id, 'note', 'Carol called — saw my Instagram post about Summit market. Colonial at 17 Summit Crest Dr. They want to move to a 55+ community in Florida. Motivated but emotional.', false, false, false, 'outbound', ((DATE '2026-04-15' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c14, v_agent_id, 'call', 'Listing consultation Apr 18. Good bones but kitchen is very dated (1990s). Suggested $875K with the right buyers who want to update. Priced to attract offers.', false, false, false, 'outbound', ((DATE '2026-04-18' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),
  (c14, v_agent_id, 'note', 'LISTED May 8 at $875,000. 3 showings in first month — buyers love the lot but all mentioning the kitchen.', false, false, false, 'outbound', ((DATE '2026-05-08' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (c14, v_agent_id, 'call', 'Market feedback call with Carol — 3 agents independently said kitchen is the objection. Discussed 2 options: price reduction $845K or $20K kitchen refresh. They want to think.', false, false, false, 'outbound', ((DATE '2026-06-01' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),
  (c14, v_agent_id, 'showing', 'Two showings Jun 21 — touring buyers seemed very interested despite kitchen. One asked about seller credit.', false, false, false, 'outbound', ((DATE '2026-06-21' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c14, v_agent_id, 'text', 'Carol — both couples from Sunday''s showings have requested disclosures! This is very encouraging. I''ll keep you posted on next steps.', false, false, true, 'outbound', ((DATE '2026-06-21' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC'),

  -- ---- Diana Fenton (c15) — seller, Paramus pre-listing ----
  (c15, v_agent_id, 'note', 'Diana inherited her mother''s home in Paramus. Estate attorney said title won''t clear until August. She wants to list in September. Keeping warm.', false, false, false, 'outbound', ((DATE '2026-05-28' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c15, v_agent_id, 'text', 'Diana — I''ve been watching the Paramus market closely. Inventory is low and prices are strong. When the title clears, we''ll be perfectly positioned. I''ll check back in August!', false, false, true, 'outbound', ((DATE '2026-06-05' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),
  (c15, v_agent_id, 'text', 'Thank you Sarah. That''s reassuring. We''ll talk in August.', false, false, false, 'inbound', ((DATE '2026-06-05' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),

  -- ---- Daniel & Sofia Moretti (c16) — buyer, Fort Lee nurture ----
  (c16, v_agent_id, 'note', 'Facebook ad lead. Relocating from SF for Daniel''s job at BioNJ in Fort Lee. Both remote workers — need 2 home offices. Researching NJ market. Pre-approval in progress.', false, false, false, 'outbound', ((DATE '2026-04-05' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),
  (c16, v_agent_id, 'call', 'Intro call — great conversation. Sofia is excited about NJ, Daniel is nervous about leaving SF. Sent neighborhood guide for Fort Lee, Edgewater, Ridgefield.', false, false, false, 'outbound', ((DATE '2026-04-07' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c16, v_agent_id, 'text', 'Daniel & Sofia — as promised, here''s the Bergen County relocation guide I put together. Fort Lee has incredible Hudson views and you''re 12 min to the GWB. Call anytime!', false, false, true, 'outbound', ((DATE '2026-04-08' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC'),
  (c16, v_agent_id, 'call', 'Pre-approval update — Sofia says bank needs 2 more pay stubs (Daniel just started job). Targeting May pre-approval. Scheduled virtual tour for May 20.', false, false, false, 'outbound', ((DATE '2026-05-05' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c16, v_agent_id, 'text', 'Daniel — I''ll be hosting an open house at 55 Linwood Ave, Fort Lee this Sunday 1-3pm. 4BR with TWO home offices and stunning renovation. If you can''t make it I''ll FaceTime you a tour!', false, false, true, 'outbound', ((DATE '2026-06-09' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),
  (c16, v_agent_id, 'text', 'Sarah we''d love the FaceTime tour! We''re not landing until June 20. Can we do it Monday the 22nd?', false, false, false, 'inbound', ((DATE '2026-06-09' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c16, v_agent_id, 'note', 'Virtual FaceTime tour of 55 Linwood scheduled for Jun 22. Getting close — Moreitis arrive in NJ Jun 20 and want to tour in person the following weekend.', false, false, false, 'outbound', ((DATE '2026-06-16' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),

  -- ---- Kevin Okafor (c17) — buyer, Paramus nurture ----
  (c17, v_agent_id, 'note', 'Zillow inquiry Apr 20. First-time buyer, been renting in Hackensack for 5 years. Getting pre-approval through Chase — budget $650-750K.', false, false, false, 'outbound', ((DATE '2026-04-20' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c17, v_agent_id, 'text', 'Hi Kevin! Congratulations on taking this big step. I''d love to walk you through the Paramus market and help you find the right home. When can we chat?', false, false, true, 'outbound', ((DATE '2026-04-20' + v_shift) + TIME '15:30:00') AT TIME ZONE 'UTC'),
  (c17, v_agent_id, 'call', 'Intro call — educated Kevin on the buying process, explained pre-approval importance. Sent him checklist of docs needed. Very receptive.', false, false, false, 'outbound', ((DATE '2026-04-22' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),
  (c17, v_agent_id, 'text', 'Kevin — checking in! How''s the pre-approval going? Spring market is moving fast. Want to make sure you''re ready when the right house appears.', false, false, true, 'outbound', ((DATE '2026-05-20' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),
  (c17, v_agent_id, 'text', 'Hi Sarah! Pre-approval should be done by next week. Chase has everything they need.', false, false, false, 'inbound', ((DATE '2026-05-20' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),
  (c17, v_agent_id, 'text', 'Kevin — I''m seeing a few great Paramus homes coming to market soon. Once you have that pre-approval letter, we can move quickly. Rooting for you! 🏡', false, false, true, 'outbound', ((DATE '2026-06-14' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),

  -- ---- Chris Nakamura (c18) — buyer, Summit nurture ----
  (c18, v_agent_id, 'note', 'Google ad lead Apr 28. Executive at pharma company in Florham Park. Short commute essential. Wants turnkey, no projects. Budget $1.1-1.4M.', false, false, false, 'outbound', ((DATE '2026-04-28' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c18, v_agent_id, 'call', 'Intro call. Very clear about what he doesn''t want — dated kitchens, small lots, busy streets. Sent 3 Summit listings that match criteria.', false, false, false, 'outbound', ((DATE '2026-04-30' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),
  (c18, v_agent_id, 'text', 'Chris — sent 3 listings to your email just now. The one on Hampshire Ct is my top pick for you. Fully renovated, quiet cul-de-sac, 10 min to Florham Park.', false, false, true, 'outbound', ((DATE '2026-04-30' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c18, v_agent_id, 'text', 'Thank you Sarah. Reviewed them. Hampshire looks promising. Can we tour in June when I''m back from a work trip?', false, false, false, 'inbound', ((DATE '2026-05-01' + v_shift) + TIME '08:00:00') AT TIME ZONE 'UTC'),
  (c18, v_agent_id, 'text', 'Chris — welcome back! Ready to pick up where we left off? I have 2 excellent Summit options to show you this weekend.', false, false, true, 'outbound', ((DATE '2026-06-12' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),

  -- ---- Victor Reyes (c19) — buyer, Fort Lee ----
  (c19, v_agent_id, 'note', 'Zillow inquiry May 5. Single buyer, flexible — looking at condos vs townhouses in Fort Lee. Pre-approved $650K. Wants low maintenance.', false, false, false, 'outbound', ((DATE '2026-05-05' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c19, v_agent_id, 'text', 'Hi Victor! Sarah Levine here. Fort Lee has great options in your range — both condos with amenities and townhouses with yards. Would love to find you the right fit. Chat this week?', false, false, true, 'outbound', ((DATE '2026-05-05' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c19, v_agent_id, 'call', 'Intro call — Victor is 35, focused on building equity. Sent him condo vs townhouse comparison. Will touch base after he reviews.', false, false, false, 'outbound', ((DATE '2026-05-08' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),
  (c19, v_agent_id, 'text', 'Victor — I wanted to check in. Have you had a chance to review the comparison I sent? Any questions? The Fort Lee market has some great inventory right now.', false, false, true, 'outbound', ((DATE '2026-06-08' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),
  (c19, v_agent_id, 'text', 'Hey Sarah, sorry for the slow reply. I''m leaning toward a townhouse. Can we set up a couple of showings?', false, false, false, 'inbound', ((DATE '2026-06-08' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),

  -- ---- Veronica & Paul Caruso (c20) — buyers, Summit, slow nurture ----
  (c20, v_agent_id, 'note', 'Referral from Westfield friend. Youngest child graduates 8th grade next June — won''t move until next spring at earliest. Keeping warm.', false, false, false, 'outbound', ((DATE '2026-05-10' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c20, v_agent_id, 'call', 'Intro call with Veronica — very pleasant. They want Summit or Westfield. Budget $800-950K. Not in a rush but want to be on my radar.', false, false, false, 'outbound', ((DATE '2026-05-12' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),
  (c20, v_agent_id, 'text', 'Veronica & Paul — great speaking with you! I''ll keep you updated on the Summit/Westfield market and let you know when something special comes up. Enjoy the spring! 😊', false, false, true, 'outbound', ((DATE '2026-06-01' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),
  (c20, v_agent_id, 'text', 'Thank you Sarah, that''s exactly what we need right now. We''ll be in touch!', false, false, false, 'inbound', ((DATE '2026-06-01' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),

  -- ---- Stephanie Walsh (c21) — buyer, Tenafly, new lead ----
  (c21, v_agent_id, 'text', 'Hi Stephanie! This is Sarah Levine — I received your Zillow inquiry about Tenafly. I''d love to help you find your home here. Are you free for a quick call?', false, false, true, 'outbound', ((DATE '2026-06-21' + v_shift) + TIME '21:00:00') AT TIME ZONE 'UTC'),

  -- ---- Jessica Bloom (c22) — buyer, new ----
  (c22, v_agent_id, 'text', 'Hi Jessica! Thanks for reaching out through Google. Paramus has some excellent opportunities right now in your range. Would love to connect — when''s a good time?', false, false, true, 'outbound', ((DATE '2026-06-21' + v_shift) + TIME '00:00:00') AT TIME ZONE 'UTC'),

  -- ---- Tyler & Nicole Chambers (c23) — buyer, new ----
  (c23, v_agent_id, 'text', 'Tyler & Nicole — Priya Patel mentioned you! So glad to connect. I''d love to introduce myself and start searching for your Westfield home. Can we set up a call this week?', false, false, true, 'outbound', ((DATE '2026-06-22' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),

  -- ---- Grace Liu (c24) — buyer, new ----
  (c24, v_agent_id, 'text', 'Hi Grace! I saw your DM about 44 Glenwood — it sold but I have similar options coming up in Englewood. Would love to connect and find you something great!', false, false, true, 'outbound', ((DATE '2026-06-22' + v_shift) + TIME '00:00:00') AT TIME ZONE 'UTC'),

  -- ---- Sean Fitzpatrick (c25) — buyer, brand new ----
  (c25, v_agent_id, 'note', 'Zillow inquiry received this morning on 18 Birchwood listing. Left a voicemail. Will call again this afternoon.', false, false, false, 'outbound', ((DATE '2026-06-22' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC');


  -- ===========================================================================
  -- TASKS (follow-up actions, mix of AI-generated and manual)
  -- ===========================================================================
  INSERT INTO public.tasks (client_id, agent_id, title, due_at, done, created_at)
  VALUES

  -- Marcus & Jen Holloway (c01)
  (c01, v_agent_id, 'Submit offer at $1.33M with escalation to $1.375M', ((DATE '2026-06-23' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-20' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),
  (c01, v_agent_id, 'Pull final comps for 18 Birchwood — verify no recent sales', ((DATE '2026-06-22' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-18' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),

  -- Rachel Kim (c02)
  (c02, v_agent_id, 'Write offer for 94 Palisade Ave at $800K with escalation', ((DATE '2026-06-22' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-19' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c02, v_agent_id, 'Send Rachel pre-approval letter checklist', ((DATE '2026-06-22' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC', true, ((DATE '2026-06-14' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),

  -- Amanda & Tom Brennan (c03)
  (c03, v_agent_id, 'Send offer worksheet for 210 Hillcrest Rd to Brennans', ((DATE '2026-06-22' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-21' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),
  (c03, v_agent_id, 'Confirm Brennan pre-approval letter is current (expires?)', ((DATE '2026-06-23' + v_shift) + TIME '09:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-21' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),

  -- Priya & Raj Patel (c04)
  (c04, v_agent_id, 'Schedule second tour of 7 Orchard Ln for Sunday Jun 28', ((DATE '2026-06-23' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-18' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),
  (c04, v_agent_id, 'Review Westfield HOA docs for Orchard Ln before showing', ((DATE '2026-06-27' + v_shift) + TIME '09:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-18' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),

  -- Brian & Kelly McGrath (c05)
  (c05, v_agent_id, 'Confirm private showing of pocket listing for Kelly & Brian Fri Jun 26', ((DATE '2026-06-23' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-17' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),

  -- Yuki Tanaka (c06)
  (c06, v_agent_id, 'Confirm appraisal appointment Jun 24 with both attorneys', ((DATE '2026-06-23' + v_shift) + TIME '09:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-21' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC'),
  (c06, v_agent_id, 'Schedule final walkthrough at 33 River Rd — week of Jul 14', ((DATE '2026-07-08' + v_shift) + TIME '09:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-16' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),

  -- Omar & Layla Hassan (c07)
  (c07, v_agent_id, 'Follow up with CCFCU on mortgage commitment ETA (Jun 30 deadline)', ((DATE '2026-06-24' + v_shift) + TIME '09:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-20' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c07, v_agent_id, 'Remind Hassans: provide insurance binder 7 days before closing', ((DATE '2026-07-03' + v_shift) + TIME '09:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-20' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),

  -- Alex & Nadia Goldstein (c08) — completed tasks preserved
  (c08, v_agent_id, 'Send closing gift — Amazon gift card + personalized note', ((DATE '2026-04-15' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC', true, ((DATE '2026-04-11' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC'),

  -- Megan Slattery (c09) — completed
  (c09, v_agent_id, 'Send Megan closing gift and Sarasota moving tips', ((DATE '2026-03-25' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC', true, ((DATE '2026-03-21' + v_shift) + TIME '19:00:00') AT TIME ZONE 'UTC'),

  -- Robert & Amy DeSantis (c10) — completed
  (c10, v_agent_id, 'Request Google review from DeSantis family', ((DATE '2026-05-10' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC', true, ((DATE '2026-05-02' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC'),

  -- Janet Kowalski (c11)
  (c11, v_agent_id, 'Collect feedback from Sat/Sun showings and share with Janet', ((DATE '2026-06-23' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-21' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),
  (c11, v_agent_id, 'Discuss price strategy with Janet — 80 days on market Jun 21', ((DATE '2026-06-25' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-21' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),

  -- Phil & Gwen Harrington (c12)
  (c12, v_agent_id, 'Follow up with Harringtons after their other agent meetings', ((DATE '2026-06-25' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-10' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC'),

  -- Thomas Nguyen (c13)
  (c13, v_agent_id, 'Confirm final walkthrough date Jul 11 with buyer agent', ((DATE '2026-06-28' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-20' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),

  -- Carol & Bob Ostrowski (c14)
  (c14, v_agent_id, 'Collect Sun Jun 21 showing feedback and discuss with Carol', ((DATE '2026-06-23' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-21' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),
  (c14, v_agent_id, 'Prepare price reduction analysis for Summit Crest if no offer by Jul 1', ((DATE '2026-07-01' + v_shift) + TIME '09:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-21' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC'),

  -- Daniel & Sofia Moretti (c16)
  (c16, v_agent_id, 'FaceTime tour of 55 Linwood Ave with Moreitis Mon Jun 22', ((DATE '2026-06-22' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-16' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),

  -- Kevin Okafor (c17)
  (c17, v_agent_id, 'Confirm Kevin has received pre-approval from Chase — follow up Jun 28', ((DATE '2026-06-28' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-14' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),

  -- Chris Nakamura (c18)
  (c18, v_agent_id, 'Schedule Summit showings with Chris for weekend of Jun 28', ((DATE '2026-06-23' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-12' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC'),

  -- Victor Reyes (c19)
  (c19, v_agent_id, 'Book 2 Fort Lee townhouse showings for Victor this week', ((DATE '2026-06-24' + v_shift) + TIME '10:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-08' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC'),

  -- Stephanie Walsh (c21) — new lead
  (c21, v_agent_id, 'Call Stephanie Walsh back — new Zillow lead from today', ((DATE '2026-06-22' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-21' + v_shift) + TIME '20:30:00') AT TIME ZONE 'UTC'),

  -- Sean Fitzpatrick (c25) — newest lead
  (c25, v_agent_id, 'Call Sean Fitzpatrick — Zillow inquiry on 18 Birchwood', ((DATE '2026-06-22' + v_shift) + TIME '17:00:00') AT TIME ZONE 'UTC', false, ((DATE '2026-06-22' + v_shift) + TIME '14:30:00') AT TIME ZONE 'UTC');


  -- ===========================================================================
  -- SHOWINGS (past + upcoming)
  -- ===========================================================================
  INSERT INTO public.showings (
    client_id, agent_id, address, showing_date, status,
    client_feedback, ai_summary, next_action, notes, created_at
  ) VALUES

  -- Marcus & Jen Holloway (c01) — 3 tours of Birchwood
  (c01, v_agent_id, '18 Birchwood Dr, Tenafly', ((DATE '2026-01-04' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', 'completed',
   'Love the cul-de-sac and garage. Kitchen looks good. Jen wants more master bath.',
   'Strong initial interest. Kitchen and garage scored well. Primary bath may be a hesitation point. Worth a second showing.',
   'Follow up in 2 weeks — monitor for competing interest.', null, ((DATE '2026-01-04' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (c01, v_agent_id, '18 Birchwood Dr, Tenafly', ((DATE '2026-03-08' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', 'completed',
   'Much better this time. Kitchen is beautiful. Jen loves the primary suite. Marcus measured the garage — fits 3 cars. Very interested.',
   'Significant increase in enthusiasm from visit 1. Both buyers engaged and taking measurements — strong buying signal. Recommend offer conversation.',
   'Prepare CMA and offer strategy. Strike before competition intensifies.', null, ((DATE '2026-03-08' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (c01, v_agent_id, '18 Birchwood Dr, Tenafly', ((DATE '2026-06-14' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'completed',
   'Brought a contractor friend — house is solid. Ready to write offer this weekend.',
   'Inspector friend gave clean review. Marcus confident on condition. Jen enthusiastic. Very high closing probability.',
   'Write offer at $1.33M with escalation clause. Target submission Jun 23.', null, ((DATE '2026-06-14' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Upcoming showing — Marcus 2nd property
  (c01, v_agent_id, '22 Maple Ct, Tenafly', ((DATE '2026-06-28' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'scheduled',
   null, null, 'Backup option in case Birchwood deal falls through.', null, ((DATE '2026-06-20' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Rachel Kim (c02)
  (c02, v_agent_id, '44 Glenwood Ave, Englewood', ((DATE '2026-02-08' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', 'completed',
   'Love the renovation but worried about street noise from main road.',
   'Strong reaction to aesthetics but noise concern is legitimate. This house went under contract anyway.',
   'Pivot to quieter Englewood streets — Palisade corridor.', null, ((DATE '2026-02-08' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (c02, v_agent_id, '94 Palisade Ave, Englewood', ((DATE '2026-06-14' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'completed',
   'Very impressed — kitchen is gorgeous and the block is quiet. Want to know about the neighbors and HOA.',
   'Buyer has clear buying signals: asking logistical questions, admiring renovation quality. No major objections.',
   'Write offer this week — reviewed comps, $799K is fair market value.', null, ((DATE '2026-06-14' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Upcoming for Rachel
  (c02, v_agent_id, '94 Palisade Ave, Englewood', (v_today + TIME '15:00:00') AT TIME ZONE 'UTC', 'scheduled',
   null, null, 'Second visit before offer if needed.', null, ((DATE '2026-06-19' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Amanda & Tom Brennan (c03)
  (c03, v_agent_id, '210 Hillcrest Rd, Ridgewood', ((DATE '2026-04-12' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'completed',
   'Love the yard and the street. Kitchen would need work. Price feels high for what it needs.',
   'Yard and location resonated strongly. Budget tension with list price and needed kitchen update.',
   'Monitor for price reduction opportunity — 45 days on market, seller has motivation.', null, ((DATE '2026-04-12' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (c03, v_agent_id, '210 Hillcrest Rd, Ridgewood', ((DATE '2026-06-15' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'completed',
   'Tom''s contractor friend says kitchen refresh is $28-32K. Amanda loves the yard. We think it''s worth it at the right price.',
   'Second visit confirmed strong fit. Contractor estimate gives buyers confidence in true cost. Offer at $940-950K likely to succeed.',
   'Submit offer at $945K — seller has motivation, 45+ days on market.', null, ((DATE '2026-06-15' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Priya & Raj Patel (c04)
  (c04, v_agent_id, '14 Devon Pl, Cranford', ((DATE '2026-03-15' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', 'completed',
   'Nice but basement too small for parents. Layout doesn''t work for multi-generational living.',
   'Basement size is a dealbreaker. Need minimum 800 sqft finished basement.',
   'Refine search criteria — emphasize finished basement requirements to listing agents.', null, ((DATE '2026-03-15' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (c04, v_agent_id, '7 Orchard Ln, Westfield', ((DATE '2026-06-07' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'completed',
   'Raj loved the finished basement — exactly what we need for his parents. Priya noted dated primary bath but loves the yard and size.',
   'Strong candidate. Basement scores high. Primary bath objection is cosmetic — $15K fix. Yard perfect for family gatherings.',
   'Bring them back for second look — schedule weekend of Jun 28.', null, ((DATE '2026-06-07' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Upcoming Patel tour
  (c04, v_agent_id, '7 Orchard Ln, Westfield', ((DATE '2026-06-28' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'scheduled',
   null, null, 'Second visit before offer — Raj and Priya want to remeasure basement.', null, ((DATE '2026-06-18' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Brian & Kelly McGrath (c05)
  (c05, v_agent_id, '47 Overlook Rd, Cresskill', ((DATE '2026-04-05' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'completed',
   'Kelly loves it but $1.25M is too much. Great home office and mudroom setup. Perfect layout.',
   'Strong emotional connection from Kelly on layout. Price is the only barrier.',
   'Monitor for price reduction — listed $1.25M, may come down after spring season.', null, ((DATE '2026-04-05' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (c05, v_agent_id, '18 Birchwood Dr, Tenafly', ((DATE '2026-05-10' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'completed',
   'We like it but already heard Holloways are interested. Don''t want a bidding war.',
   'Good property but competition anxiety. Holloways are strong competition. Brennans decided not to pursue.',
   'Find alternative with less competition — look at pocket listings.', null, ((DATE '2026-05-10' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Upcoming McGrath private showing
  (c05, v_agent_id, '21 Terrace Ave, Englewood', ((DATE '2026-06-26' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC', 'scheduled',
   null, null, 'Pocket listing — not yet on MLS. Home office + mudroom confirmed.', null, ((DATE '2026-06-17' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Yuki Tanaka (c06) — complete arc
  (c06, v_agent_id, '22 Sherwood Ct, Ridgewood', ((DATE '2026-03-22' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', 'completed',
   'Good location but only 2BA. I need 2 full baths minimum. Passing.',
   'Bathroom count is a dealbreaker for this buyer. Move on.',
   'Strictly filter for 2+ full baths going forward.', null, ((DATE '2026-03-22' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (c06, v_agent_id, '33 River Rd, Ridgewood', ((DATE '2026-03-22' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC', 'completed',
   'This is the one. Layout is perfect. Kitchen is updated. I measured every room. Love the street.',
   'Immediate and strong connection. Buyer is methodical and data-driven — she''s confident. High close probability.',
   'Prepare offer strategy. Competition likely — move quickly.', null, ((DATE '2026-03-22' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (c06, v_agent_id, '33 River Rd, Ridgewood', ((DATE '2026-04-05' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', 'completed',
   'Second visit to remeasure and think. I''m ready to offer.',
   'Buyer is decisive. Second visit was confirmation, not discovery. Offer imminent.',
   'Submit offer immediately. Multiple offers expected.', null, ((DATE '2026-04-05' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Omar & Layla Hassan (c07)
  (c07, v_agent_id, '88 Main St #4B, Edgewater', ((DATE '2026-03-08' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', 'completed',
   'Too small. Kids would be sharing rooms. Condo fees are high.',
   'Size and HOA cost are dealbreakers. Pivot to townhouses and single-family.',
   'Rule out condos entirely. Focus Fort Lee/Edgewater single-family and townhouses.', null, ((DATE '2026-03-08' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (c07, v_agent_id, '12 Harbor View Ct, Fort Lee', ((DATE '2026-03-08' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC', 'completed',
   'This is incredible. Hudson views, gated, 4 full bedrooms. The commute is perfect. This is our house.',
   'Immediate and strong connection. Views, layout, and commute all exceed expectations. Top candidate.',
   'Prepare offer strategy. Priced fairly at $999K with views premium.', null, ((DATE '2026-03-08' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (c07, v_agent_id, '12 Harbor View Ct, Fort Lee', ((DATE '2026-04-20' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'completed',
   'Brought my father — he loved it too. Omar''s father said "make the offer, son."',
   'Family approval obtained. Omar''s father''s blessing was the final deciding factor. Offer is coming.',
   'Draft offer at $985K. Discuss escalation strategy.', null, ((DATE '2026-04-20' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Janet Kowalski (c11) — showings on her listing
  (c11, v_agent_id, '82 Prospect St, Tenafly', ((DATE '2026-06-21' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'completed',
   'Buyers (couple in 30s, 2 young kids) — loved the yard and school district proximity. Master bath and dated powder room were mentioned.',
   'Strong family fit. Kids toured and ran in the yard — emotional connection forming. Bath update is cosmetic concern.',
   'Follow up with buyer agent Monday — push for offer.', null, ((DATE '2026-06-21' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (c11, v_agent_id, '82 Prospect St, Tenafly', ((DATE '2026-06-21' + v_shift) + TIME '18:00:00') AT TIME ZONE 'UTC', 'completed',
   'Buyers (empty nesters, relocating from Manhattan) — love the renovation quality and quiet street. Said it''s at the top of their list.',
   'Serious interest from second couple. Multiple buyer situation may develop this week.',
   'Request disclosures for both parties. Prepare to handle multiple offers if they materialize.', null, ((DATE '2026-06-21' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Carol & Bob Ostrowski (c14) showings on listing
  (c14, v_agent_id, '17 Summit Crest Dr, Summit', ((DATE '2026-05-18' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'completed',
   'Buyers liked the lot and location. Kitchen is the concern — they said they''d need $40K to update.',
   'Second showing this month. Kitchen consistently the objection. Price or update required.',
   'Discuss price reduction strategy with Carol — 45 days on market.', null, ((DATE '2026-05-18' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  (c14, v_agent_id, '17 Summit Crest Dr, Summit', ((DATE '2026-06-21' + v_shift) + TIME '15:00:00') AT TIME ZONE 'UTC', 'completed',
   'Very interested buyer — asked about kitchen credit and seller closing cost assistance.',
   'Buyer is engaged and asking financial structure questions. Offer likely imminent if we can address kitchen concern.',
   'Prepare seller credit scenario for Carol — offer $15K kitchen credit to close a deal.', null, ((DATE '2026-06-21' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC');


  -- ===========================================================================
  -- TRANSACTIONS for Thomas Nguyen (seller side) — complement to buyers above
  -- ===========================================================================
  INSERT INTO public.transactions (
    client_id, agent_id, address, contract_price, closing_date,
    inspection_date, appraisal_date, mortgage_commitment_date,
    attorney_name, attorney_email, lender_name, lender_email,
    status, notes, created_at
  ) VALUES
  (c13, v_agent_id, '308 Anderson Ave, Fort Lee, NJ', 861000,
   ((DATE '2026-07-14' + v_shift) + TIME '16:00:00') AT TIME ZONE 'UTC', ((DATE '2026-05-05' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC', ((DATE '2026-05-12' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC', ((DATE '2026-05-20' + v_shift) + TIME '14:00:00') AT TIME ZONE 'UTC',
   'Michael Tan, Esq.', 'mtan@tanattorneys.com', 'PNC Mortgage', 'nj@pncmortgage.com',
   'active', 'Listed Apr 15, accepted Apr 28 at $861K. Inspection clean. Appraisal at value. Closing Jul 14. Smooth transaction.',
   ((DATE '2026-04-28' + v_shift) + TIME '20:00:00') AT TIME ZONE 'UTC');


  -- ===========================================================================
  -- PROPERTY MATCHES (top scored client-property pairs)
  -- ===========================================================================
  INSERT INTO public.property_matches (
    property_id, client_id, agent_id, match_score, match_reasons, notified, created_at
  ) VALUES

  (p01, c01, v_agent_id, 94, '["preferred town ✅","budget ✅ ($1.35M in range)","5BR ✅","3.5BA ✅"]', true, ((DATE '2025-12-30' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (p02, c02, v_agent_id, 91, '["preferred town ✅","budget ✅ ($799K)","3BR ✅","2BA ✅"]', true, ((DATE '2026-06-10' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (p03, c03, v_agent_id, 88, '["preferred town ✅","budget range ✅","4BR ✅","2.5BA ✅"]', true, ((DATE '2026-02-15' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (p04, c04, v_agent_id, 90, '["preferred town ✅","budget ✅","4BR ✅","2.5BA ✅","flat yard noted"]', true, ((DATE '2026-01-25' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (p05, c05, v_agent_id, 85, '["preferred town ✅","budget ✅","4BR ✅","home office potential"]', true, ((DATE '2026-03-05' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (p06, c06, v_agent_id, 96, '["preferred town ✅","budget ✅ ($872K accepted)","3BR ✅","under contract"]', true, ((DATE '2026-02-05' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (p07, c07, v_agent_id, 95, '["preferred town ✅","budget ✅","4BR ✅","GWB proximity ✅","under contract"]', true, ((DATE '2026-01-18' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (p08, c08, v_agent_id, 97, '["preferred town ✅","budget ✅","4BR ✅","closed ✅"]', true, ((DATE '2025-12-23' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (p09, c09, v_agent_id, 99, '["agent listing","seller client","sold ✅"]', true, ((DATE '2025-12-29' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (p10, c10, v_agent_id, 93, '["preferred town ✅","budget ✅","5BR ✅","0.6 acre ✅","closed ✅"]', true, ((DATE '2025-12-31' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (p11, c14, v_agent_id, 87, '["seller listing","Summit ✅","4BR ✅"]', true, ((DATE '2026-05-08' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  -- Cross-matches for active buyers
  (p01, c10, v_agent_id, 89, '["Tenafly ✅","budget ✅","5BR ✅"]', true, ((DATE '2026-01-03' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (p03, c18, v_agent_id, 82, '["Ridgewood adjacent to Summit","4BR ✅","budget stretch"]', false, ((DATE '2026-05-22' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),
  (p11, c18, v_agent_id, 91, '["preferred town ✅","4BR ✅","budget ✅"]', true, ((DATE '2026-05-08' + v_shift) + TIME '12:00:00') AT TIME ZONE 'UTC'),

  -- Brand-new matches (created "now") — these are what should show up as
  -- unnotified MLS-match cards on today's dashboard.
  (p12, c17, v_agent_id, 90, '["preferred town ✅","budget ✅ ($685K)","3BR ✅","new listing"]', false, (v_today + TIME '09:05:00') AT TIME ZONE 'UTC'),
  (p13, c19, v_agent_id, 88, '["preferred town ✅","budget ✅ ($625K)","townhouse ✅","new listing"]', false, (v_today + TIME '09:20:00') AT TIME ZONE 'UTC');


  -- ===========================================================================
  -- NOTIFICATIONS (recent unread alerts for Sarah's dashboard)
  -- ===========================================================================
  INSERT INTO public.notifications (
    agent_id, kind, title, body, related_client_id, read, dedup_key, created_at
  ) VALUES

  (v_agent_id, 'engagement_alert', 'Tyler & Nicole Chambers — new referral lead',
   'Patel family referred Tyler & Nicole Chambers. Reached out today — first-time contact.',
   c23, false, 'new-lead-c23-2026-06-22', ((DATE '2026-06-22' + v_shift) + TIME '12:30:00') AT TIME ZONE 'UTC'),

  (v_agent_id, 'engagement_alert', 'Sean Fitzpatrick — Zillow inquiry on Birchwood',
   'New Zillow lead on 18 Birchwood Dr. Left voicemail — follow up this afternoon.',
   c25, false, 'new-lead-c25-2026-06-22', ((DATE '2026-06-22' + v_shift) + TIME '14:15:00') AT TIME ZONE 'UTC'),

  (v_agent_id, 'showing_reminder', 'Marcus Holloway offer submission due tomorrow',
   'Marcus & Jen ready to submit offer on 18 Birchwood Dr, Tenafly. Draft offer tonight.',
   c01, false, 'offer-c01-birchwood-jun23', ((DATE '2026-06-22' + v_shift) + TIME '08:00:00') AT TIME ZONE 'UTC'),

  (v_agent_id, 'task_due', 'Rachel Kim offer — 94 Palisade Ave',
   'Rachel confirmed she wants to write offer at $800K. Offer worksheet due today.',
   c02, false, 'offer-c02-palisade-jun22', ((DATE '2026-06-22' + v_shift) + TIME '09:00:00') AT TIME ZONE 'UTC'),

  (v_agent_id, 'showing_reminder', 'Appraisal — 33 River Rd (Yuki Tanaka) Mon Jun 24',
   'Appraisal scheduled for Monday. Confirm appraiser has access and agent contact.',
   c06, false, 'appraisal-c06-jun24', ((DATE '2026-06-22' + v_shift) + TIME '07:00:00') AT TIME ZONE 'UTC'),

  (v_agent_id, 'engagement_alert', 'Janet Kowalski — 2 serious showing groups this weekend',
   'Both Sunday couples requested disclosures. May be heading toward multiple offers.',
   c11, false, 'showings-c11-jun21', ((DATE '2026-06-21' + v_shift) + TIME '22:00:00') AT TIME ZONE 'UTC'),

  (v_agent_id, 'match_found', 'New match: 94 Palisade Ave → Rachel Kim (score 91)',
   '94 Palisade Ave is a 91-point match for Rachel Kim. Budget, beds, and town all align.',
   c02, true, 'match-p02-c02', ((DATE '2026-06-10' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC'),

  (v_agent_id, 'match_found', 'New match: 210 Hillcrest Rd → Amanda & Tom Brennan (score 88)',
   '210 Hillcrest Rd matches Brennan criteria. Ridgewood east side, 4BR, in budget range.',
   c03, true, 'match-p03-c03', ((DATE '2026-02-15' + v_shift) + TIME '13:00:00') AT TIME ZONE 'UTC');


  RAISE NOTICE 'Demo seed complete — 25 clients, 13 properties, 3 listings, activities, tasks, showings, transactions, matches, and notifications inserted for agent % (shifted % days from original anchor).', v_agent_id, v_shift;

END $$;

-- =============================================================================
-- DEMO PHOTOS — attaches free, real Unsplash exterior + interior photos to
-- this agent's properties so the UI shows real-looking homes instead of the
-- placeholder house icon. NOT real MLS photos — for demo purposes only.
-- All images verified as real, valid, on-topic house photos before use
-- (one candidate turned out to be a car and was discarded).
--
-- Matches by (agent_id, address) rather than id, since re-running
-- seed_demo.sql regenerates property ids on every run but addresses stay
-- the same — safe to re-run this script any time after a reseed.
--
-- RE-RUNNABLE: plain UPDATEs, safe to run more than once.
-- =============================================================================

DO $$
DECLARE
  v_agent_id UUID := '653cc608-a055-406b-9de1-310bf76a4e75';
BEGIN

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '18 Birchwood Dr, Tenafly';

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80","https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '94 Palisade Ave, Englewood';

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80","https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '210 Hillcrest Rd, Ridgewood';

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80","https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '7 Orchard Ln, Westfield';

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80","https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '55 Linwood Ave, Fort Lee';

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=1200&q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '33 River Rd, Ridgewood';

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=1200&q=80","https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '12 Harbor View Ct, Fort Lee';

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80","https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '6 Elm Terrace, Westfield';

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80","https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '44 Glenwood Ave, Englewood';

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=80","https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '29 Alpine Rd, Tenafly';

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1200&q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '8 Terrace Way, Fort Lee';

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=80","https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '23 Fairview Ave, Paramus';

  UPDATE public.properties SET photos = '["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80","https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80"]'::jsonb
    WHERE agent_id = v_agent_id AND address = '17 Summit Crest Dr, Summit';

  RAISE NOTICE 'Demo photos attached for agent %', v_agent_id;

END $$;

/*
  # Seed Sample Data for The Funding Fix OS

  Adds sample resources, events, and default content to make the platform
  immediately useful on first launch.
*/

-- Sample Resources
INSERT INTO resources (title, description, pillar, resource_type, file_url, min_tier, is_published, created_by)
VALUES
  ('Mission Statement Builder Template', 'A step-by-step template to craft a compelling mission statement that resonates with funders.', 'clarity', 'template', '', 'free', true, null),
  ('Theory of Change Worksheet', 'Map your organization''s theory of change to demonstrate impact to grant makers.', 'clarity', 'template', '', 'core', true, null),
  ('Board Governance Handbook', 'Comprehensive guide for building and managing an effective nonprofit board.', 'structure', 'guide', '', 'core', true, null),
  ('Nonprofit Bylaws Template', 'Standard bylaws template customizable for your organization.', 'structure', 'template', '', 'core', true, null),
  ('Financial Health Checklist', 'Assess your organization''s financial health across 20 key indicators.', 'health', 'template', '', 'core', true, null),
  ('Sample Nonprofit Budget Template', 'A detailed budget template designed for grant applications and annual planning.', 'health', 'template', '', 'core', true, null),
  ('Impact Measurement Framework', 'Tools and methodology for measuring and communicating your nonprofit''s impact.', 'impact', 'guide', '', 'core', true, null),
  ('Data Collection Tools Guide', 'Best practices for collecting, organizing, and presenting program data to funders.', 'impact', 'guide', '', 'core', true, null),
  ('Grant Research Database Guide', 'How to identify and research foundation and government grant opportunities.', 'funding', 'guide', '', 'core', true, null),
  ('Grant Proposal Writing Template', 'Complete grant proposal template with annotated sections and writing tips.', 'funding', 'template', '', 'premium', true, null),
  ('Capacity Building Roadmap', 'A 12-month roadmap for building organizational capacity and sustainability.', 'transformation', 'guide', '', 'premium', true, null),
  ('Earned Revenue Strategy Guide', 'Explore social enterprise and earned revenue models for nonprofits.', 'transformation', 'guide', '', 'premium', true, null)
ON CONFLICT DO NOTHING;

-- Sample Events
INSERT INTO events (title, description, event_type, price_cents, is_published, is_virtual, location)
VALUES
  (
    'Mission to Money Summit',
    'Join nonprofit leaders from across the country for a transformative two-day summit focused on turning your mission into sustainable funding. Learn from top fundraising experts, connect with fellow leaders, and leave with a concrete action plan for your organization.',
    'summit',
    49700,
    true,
    true,
    'Virtual - Zoom'
  ),
  (
    'Making Missions Make Cents Workshop',
    'This intensive half-day workshop walks you through the C-SHIFT framework for nonprofit funding readiness. You''ll complete a live assessment, work through real funding challenges, and receive personalized feedback in our Hot Seat session. Every attendee receives the full workbook and resource toolkit.',
    'workshop',
    29700,
    true,
    true,
    'Virtual - Zoom'
  ),
  (
    '20 in 20 Nonprofits on the Move',
    'C-SHIFT''s signature program recognizing and supporting 20 high-potential nonprofits with tools, training, and visibility. Apply to be selected as one of this year''s cohort and receive intensive support from the C-SHIFT team.',
    'program',
    0,
    true,
    true,
    'Virtual'
  ),
  (
    'C-SHIFT Insight Grant',
    'The C-SHIFT Insight Grant provides up to $2,500 in consulting services to a qualifying nonprofit organization. Apply to receive a full funding readiness assessment, strategy session, and 90-day implementation support at no cost.',
    'grant',
    0,
    true,
    true,
    'Virtual'
  )
ON CONFLICT DO NOTHING;

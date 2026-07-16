export type UserRole = 'free' | 'member' | 'client' | 'admin';
export type MembershipTier = 'free' | 'founding_member' | 'growth_member' | 'premium' | 'white_glove';
export type Pillar = 'clarity' | 'structure' | 'health' | 'impact' | 'funding' | 'transformation';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  organization_name: string;
  role: UserRole;
  membership_tier: MembershipTier;
  phone: string;
  bio: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  subscription_status: string;
  created_at: string;
  updated_at: string;
  mission_statement: string;
  focus_area: string;
  geographic_location: string;
  population_served: string;
  annual_budget_range: string;
  current_programs: string;
  funding_needs: string;
  profile_visibility: 'public' | 'members_only' | 'private';
  funder_ready: boolean;
  funder_ready_approved: boolean;
  funder_ready_score: number;
  is_featured: boolean;
}

export interface Assessment {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  organization_name: string;
  total_score: number;
  max_score: number;
  clarity_score: number;
  structure_score: number;
  health_score: number;
  impact_score: number;
  funding_score: number;
  transformation_score: number;
  status: 'in_progress' | 'completed';
  results_emailed: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface AssessmentAnswer {
  id: string;
  assessment_id: string;
  pillar: Pillar;
  question_index: number;
  question_text: string;
  score: number;
  created_at: string;
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  pillar: Pillar | 'general';
  resource_type: 'document' | 'template' | 'guide' | 'video' | 'tool';
  file_url: string;
  external_url: string;
  min_tier: MembershipTier;
  is_published: boolean;
  created_at: string;
}

export interface WorkshopRegistration {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  organization_name: string;
  phone: string;
  stripe_payment_intent_id: string;
  stripe_session_id: string;
  amount_paid: number;
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed';
  workshop_date: string;
  confirmation_sent: boolean;
  materials_sent: boolean;
  zoom_link_sent: boolean;
  created_at: string;
}

export interface CommunityThread {
  id: string;
  author_id: string;
  title: string;
  content: string;
  pillar: Pillar | 'general';
  is_pinned: boolean;
  reply_count: number;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string; organization_name: string };
}

export interface CommunityReply {
  id: string;
  thread_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string };
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  is_published: boolean;
  created_at: string;
}

export interface ClientDocument {
  id: string;
  client_id: string;
  uploaded_by: string;
  title: string;
  description: string;
  file_url: string;
  file_type: string;
  pillar: Pillar | 'general';
  created_at: string;
}

export interface ClientSession {
  id: string;
  client_id: string;
  title: string;
  description: string;
  scheduled_at: string;
  duration_minutes: number;
  zoom_link: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string;
  created_at: string;
}

export interface ClientMessage {
  id: string;
  client_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  event_type: 'summit' | 'workshop' | 'grant' | 'program' | 'general';
  event_date: string | null;
  registration_deadline: string | null;
  max_attendees: number | null;
  current_attendees: number;
  price_cents: number;
  is_published: boolean;
  registration_url: string;
  location: string;
  is_virtual: boolean;
  zoom_link: string;
  created_at: string;
}

export interface HotSeatApplication {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  organization_name: string;
  challenge_description: string;
  desired_outcome: string;
  years_operating: string;
  annual_budget: string;
  status: 'pending' | 'approved' | 'declined' | 'completed';
  admin_notes: string;
  created_at: string;
}

export const PILLARS: { key: Pillar; label: string; color: string; description: string }[] = [
  { key: 'clarity', label: 'Clarity', color: '#1C7486', description: 'Mission, vision, and organizational clarity' },
  { key: 'structure', label: 'Structure', color: '#0A0A0A', description: 'Governance, bylaws, and organizational structure' },
  { key: 'health', label: 'Health', color: '#1C7486', description: 'Financial health and operational sustainability' },
  { key: 'impact', label: 'Impact', color: '#D4A843', description: 'Measuring and communicating program impact' },
  { key: 'funding', label: 'Funding', color: '#1C7486', description: 'Revenue diversification and grant readiness' },
  { key: 'transformation', label: 'Transformation', color: '#0A0A0A', description: 'Organizational growth and capacity building' },
];

export interface FunderAccessRequest {
  id: string;
  full_name: string;
  organization_name: string;
  funding_focus_areas: string;
  email: string;
  status: 'pending' | 'approved';
  created_at: string;
}

export type OrganizationStage = 'startup' | 'emerging' | 'developing' | 'established' | 'scaling';
export type NonprofitStatus = 'planning' | 'incorporated' | 'exemption_pending' | 'tax_exempt' | 'fiscally_sponsored' | 'other';
export type OrgMemberRole = 'owner' | 'executive_director' | 'administrator' | 'staff' | 'board_member' | 'consultant' | 'viewer';
export type OrgMemberStatus = 'invited' | 'active' | 'suspended' | 'removed';

export interface Organization {
  id: string;
  organization_name: string;
  legal_name: string | null;
  ein: string | null;
  mission: string | null;
  vision: string | null;
  website: string | null;
  logo_url: string | null;
  cause_area: string | null;
  primary_population: string | null;
  service_area: string | null;
  city: string | null;
  state: string | null;
  annual_budget: number | null;
  annual_revenue: number | null;
  staff_count: number | null;
  board_member_count: number | null;
  organization_stage: OrganizationStage | null;
  nonprofit_status: NonprofitStatus | null;
  owner_user_id: string | null;
  profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  organization_role: OrgMemberRole;
  membership_status: OrgMemberStatus;
  invited_by: string | null;
  joined_at: string;
  created_at: string;
}

export interface PillarScore {
  id: string;
  organization_id: string;
  assessment_id: string;
  pillar_name: 'Clarity' | 'Structure' | 'Health' | 'Impact' | 'Funding' | 'Transformation';
  raw_score: number;
  maximum_score: number;
  percentage_score: number;
  rating: 'Strong' | 'Developing' | 'Needs Attention' | 'Critical Gap';
  previous_score: number | null;
  score_change: number;
  score_source: 'assessment' | 'verified_action' | 'administrative_adjustment' | 'reassessment';
  calculated_at: string;
  created_at: string;
}

export const ORGANIZATION_STAGES: { value: OrganizationStage; label: string; description: string }[] = [
  { value: 'startup',     label: 'Startup',     description: 'Less than 1 year old, building foundations' },
  { value: 'emerging',    label: 'Emerging',    description: '1–3 years, establishing programs and structure' },
  { value: 'developing',  label: 'Developing',  description: '3–5 years, growing capacity and impact' },
  { value: 'established', label: 'Established', description: '5+ years, stable operations and track record' },
  { value: 'scaling',     label: 'Scaling',     description: 'Expanding reach, impact, or geographic footprint' },
];

export const NONPROFIT_STATUSES: { value: NonprofitStatus; label: string }[] = [
  { value: 'planning',           label: 'Planning — Not yet incorporated' },
  { value: 'incorporated',       label: 'Incorporated — No tax-exempt status yet' },
  { value: 'exemption_pending',  label: 'Exemption Pending — 501(c)(3) application submitted' },
  { value: 'tax_exempt',         label: 'Tax Exempt — 501(c)(3) approved' },
  { value: 'fiscally_sponsored', label: 'Fiscally Sponsored' },
  { value: 'other',              label: 'Other' },
];

export const ORG_ROLE_LABELS: Record<OrgMemberRole, string> = {
  owner: 'Owner',
  executive_director: 'Executive Director',
  administrator: 'Administrator',
  staff: 'Staff',
  board_member: 'Board Member',
  consultant: 'Consultant',
  viewer: 'Viewer',
};

export const ASSESSMENT_QUESTIONS: Record<Pillar, string[]> = {
  clarity: [
    'Our organization has a clearly written and regularly reviewed mission statement.',
    'Our vision for long-term impact is documented and shared with all stakeholders.',
    'Our theory of change is clearly articulated and supported by evidence.',
    'Staff, board, and volunteers can consistently explain our mission and impact.',
    'Our strategic plan aligns our programs and activities with our mission.',
  ],
  structure: [
    'We have a legally compliant board of directors with clearly defined roles.',
    'Our bylaws are current, complete, and reviewed within the last three years.',
    'We have documented policies for financial management, conflict of interest, and HR.',
    'Our 501(c)(3) status is current and all annual filings are up to date.',
    'We have a clear organizational chart and defined staff roles and responsibilities.',
  ],
  health: [
    'We have at least three months of operating expenses in an operating reserve.',
    'We consistently track and report on our budget vs. actual financials monthly.',
    'Our organization has diverse revenue streams (grants, individual giving, earned revenue).',
    'We have a current, board-approved annual budget.',
    'Our most recent audit or financial review showed no significant concerns.',
  ],
  impact: [
    'We have a defined set of program outcomes that we measure regularly.',
    'We collect and analyze data on program participants and results.',
    'We have a data management system for tracking program performance.',
    'We can demonstrate our impact with compelling statistics and stories.',
    'We use evaluation findings to improve our programs and inform funders.',
  ],
  funding: [
    'We have a written fundraising plan or development plan for the current year.',
    'We regularly research and apply to foundation and government grants.',
    'We cultivate relationships with individual major donors.',
    'We have strong grant writing capacity through staff or a capacity building and funding strategy partner.',
    'We submit grant reports on time and maintain funder relationships.',
  ],
  transformation: [
    'Our leadership team participates in ongoing professional development.',
    'We have a succession plan for key leadership positions.',
    'We regularly assess our organizational capacity and identify gaps.',
    'We have partnerships or collaborations that strengthen our work.',
    'We have a plan for scaling or deepening our impact over the next three years.',
  ],
};

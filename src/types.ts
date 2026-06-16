/**
 * Types and interfaces for the jobsreport.online Career Letter Generator
 */

export interface PersonalInfo {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  signatureText?: string;
  signatureImage?: string; // Base64 uploaded drawing or signature file
}

export interface ProfessionalInfo {
  highestEducation: string;
  yearsOfExperience: string;
  keySkills: string; // Comma separated or flat string
  currentPosition: string;
}

export interface JobInfo {
  jobTitle: string;
  companyName: string;
  companyAddress?: string;
  jobDescription: string;
  jobUrl?: string;
}

export type TargetCountry = 
  | 'Tanzania'
  | 'Kenya'
  | 'Uganda'
  | 'Rwanda'
  | 'Zambia'
  | 'Malawi'
  | 'South Africa'
  | 'United Kingdom'
  | 'Canada'
  | 'Australia'
  | 'United States'
  | 'United Arab Emirates';

export interface LetterGenerationRequest {
  personalInfo: PersonalInfo;
  professionalInfo: ProfessionalInfo;
  jobInfo: JobInfo;
  targetCountry: TargetCountry;
}

export interface ATSAnalysis {
  matchScore: number;
  matchingSkills: string[];
  missingSkills: string[];
  recommendations: string[];
  cvImprovements: string[];
}

export interface GeneratedLetters {
  id: string;
  createdAt: string;
  request: LetterGenerationRequest;
  applicationLetter: string;
  coverLetter: string;
  atsAnalysis: ATSAnalysis;
  employerCountry?: string;
  regionalStandard?: string;
}

export interface CountryHiringGuide {
  country: TargetCountry;
  flag: string;
  salutationStyle: string;
  tone: string;
  focusArea: string;
}

export const COUNTRY_GUIDES: Record<TargetCountry, CountryHiringGuide> = {
  'Tanzania': {
    country: 'Tanzania',
    flag: '🇹🇿',
    salutationStyle: 'Formal & respectful, often starting with "Dear Sir/Madam" or "Ndugu [Last Name]"',
    tone: 'Courteous, highly professional, acknowledging hierarchical structures.',
    focusArea: 'Academic qualifications, registration with professional bodies (e.g., ERB, NBAA), and community-oriented values.'
  },
  'Kenya': {
    country: 'Kenya',
    flag: '🇰🇪',
    salutationStyle: 'Standard formal (e.g., "Dear Hiring Manager" or "Dear Mr./Ms. [Last Name]")',
    tone: 'Dynamic, highly results-oriented, professional confidence.',
    focusArea: 'Action verbs, specific metric achievements, active local certifications.'
  },
  'Uganda': {
    country: 'Uganda',
    flag: '🇺🇬',
    salutationStyle: 'Formal (e.g., "Dear Director of Personnel" or "Dear Sir/Madam")',
    tone: 'Polite, dedicated, emphasizing loyalty, trust and solid credentials.',
    focusArea: 'Academic pedigree, specialized sector experiences, long-term career commitment.'
  },
  'Rwanda': {
    country: 'Rwanda',
    flag: '🇷🇼',
    salutationStyle: 'Polite, tailored (e.g., "Dear Recruitment Committee" or "Dear Dr./Director [Last Name]")',
    tone: 'Meticulous, structured, showcasing strong collaborative approach.',
    focusArea: 'Bilingual ability (English/French/Kinyarwanda), digital/technical literacy, and supporting national development goals.'
  },
  'Zambia': {
    country: 'Zambia',
    flag: '🇿🇲',
    salutationStyle: 'Highly formal (e.g. "Dear Sir/Madam" or "Dear Mr./Ms. [Last Name]")',
    tone: 'Courteous, hierarchical, business-professional and humble.',
    focusArea: 'Academic qualifications, certifications, professional body memberships (e.g., ZICA, EIZ), and continuous growth.'
  },
  'Malawi': {
    country: 'Malawi',
    flag: '🇲🇼',
    salutationStyle: 'Highly respectful and formal (e.g. "Dear Sir/Madam")',
    tone: 'Polite, dedicated, respectful of authority, and public service oriented.',
    focusArea: 'Academic credentials, long-term integrity, and institutional skill application.'
  },
  'South Africa': {
    country: 'South Africa',
    flag: '🇿🇦',
    salutationStyle: 'Standard corporate formal (e.g., "Dear Hiring Committee" or "Dear Mr./Ms. [Last Name]")',
    tone: 'Progressive, diverse, energetic but business-professional.',
    focusArea: 'Broad-Based Black Economic Empowerment (B-BBEE) awareness if applicable, adaptable soft skills, leadership.'
  },
  'United Kingdom': {
    country: 'United Kingdom',
    flag: '🇬🇧',
    salutationStyle: 'Polite formal (e.g., "Dear Hiring Team" or "Dear Dr./Mr./Ms. [Last Name]")',
    tone: 'Understated yet confident, professional modesty combined with firm records.',
    focusArea: 'Clear linkage of qualifications to job descriptors, polite language, spelling in British English (e.g., organisation, programme).'
  },
  'Canada': {
    country: 'Canada',
    flag: '🇨🇦',
    salutationStyle: 'Direct & friendly (e.g., "Dear [First Name] [Last Name]" or "Dear hiring team")',
    tone: 'Highly positive, emphasizing diversity, workplace safety/cooperation, and alignment with corporate culture.',
    focusArea: 'Volunteering experience, local equivalents of certificates, soft skills, and direct storytelling of career journeys.'
  },
  'Australia': {
    country: 'Australia',
    flag: '🇦🇺',
    salutationStyle: 'Direct and straightforward (e.g., "Dear recruiter" or "Dear [First Name]")',
    tone: 'Genuine, laid-back yet highly competent, emphasizing practical skills.',
    focusArea: 'Hands-on practical outcomes, problem-solving stories (STAR format), safety focus and teamwork.'
  },
  'United States': {
    country: 'United States',
    flag: '🇺🇸',
    salutationStyle: 'Highly persuasive (e.g., "Dear Hiring Executive" or "Dear [First Name] [Last Name]")',
    tone: 'Ambitious, direct, high-impact, assertive self-advocacy.',
    focusArea: 'Quantifiable metrics ($ increase, % cost saved), leadership initiatives, prestigious associations, career scalability.'
  },
  'United Arab Emirates': {
    country: 'United Arab Emirates',
    flag: '🇦🇪',
    salutationStyle: 'Extremely respectful (e.g., "Dear esteemed Recruitment General Manager" or "Dear Mr./Ms. [Last Name]")',
    tone: 'High prestige, respectful and highly ambitious.',
    focusArea: 'Global mindset, cross-cultural collaboration, fast-paced commercial environment capability, luxury and standard settings proficiency.'
  }
};

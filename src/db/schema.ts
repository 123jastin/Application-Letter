/**
 * JobsReport.online Application & Cover Letter Builder Database Schema
 * Standard relational structural design modeled for PostgreSQL / Cloud SQL.
 */

// Candidate User profile table
export interface CandidateRecord {
  id: string; // UUID primary key
  email: string; // Unique candidate email
  fullName: string;
  phone: string;
  address: string;
  highestEducation: string;
  yearsOfExperience: number;
  currentPosition: string;
  keySkills: string[]; // PostgreSQL Text[] or JSON array
  signatureText?: string;
  signatureImage?: string; // S3/Cloud Storage link or base64 text represent
  createdAt: string;
  updatedAt: string;
}

// Jobs posted or parsed for letter targeting
export interface JobRecord {
  id: string; // UUID primary key
  jobTitle: string;
  companyName: string;
  companyAddress?: string;
  jobDescription: string;
  jobUrl?: string; // Original URL link from JobsReport.online
  createdAt: string;
}

// Generated documents
export interface LetterRecord {
  id: string; // UUID primary key
  candidateId: string; // Foreign Key referencing CandidateRecord(id)
  jobId: string; // Foreign Key referencing JobRecord(id)
  targetCountry: string; // Tanzania, Kenya, US, Canada, etc.
  applicationLetterText: string; // High-fidelity Markdown/HTML string
  coverLetterText: string; // High-fidelity Markdown/HTML string
  createdAt: string;
  updatedAt: string;
}

// Detailed ATS Audit record linked with generated letters
export interface ATSAnalysisRecord {
  id: string; // UUID primary key
  letterId: string; // Foreign Key referencing LetterRecord(id)
  matchScore: number; // calculated percentage correlation (0 - 100)
  matchingSkills: string[]; // text array of aligned keywords
  missingSkills: string[]; // text array of missing keywords
  recommendations: string[]; // structured text logs
  cvImprovements: string[]; // step-by-step CV optimization cues
  createdAt: string;
}

/**
 * SQL Representation (DDL) for PostgreSQL
 * 
 * CREATE TABLE candidates (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     email VARCHAR(255) UNIQUE NOT NULL,
 *     full_name VARCHAR(255) NOT NULL,
 *     phone VARCHAR(50) NOT NULL,
 *     address TEXT NOT NULL,
 *     highest_education VARCHAR(255) NOT NULL,
 *     years_of_experience INT NOT NULL,
 *     current_position VARCHAR(255) NOT NULL,
 *     key_skills TEXT[] NOT NULL,
 *     signature_text VARCHAR(255),
 *     signature_image TEXT,
 *     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
 *     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
 * );
 * 
 * CREATE TABLE jobs (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     job_title VARCHAR(255) NOT NULL,
 *     company_name VARCHAR(255) NOT NULL,
 *     company_address TEXT,
 *     job_description TEXT NOT NULL,
 *     job_url VARCHAR(512),
 *     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
 * );
 * 
 * CREATE TABLE letters (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
 *     job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
 *     target_country VARCHAR(100) NOT NULL,
 *     application_letter_text TEXT NOT NULL,
 *     cover_letter_text TEXT NOT NULL,
 *     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
 *     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
 * );
 * 
 * CREATE TABLE ats_analyses (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     letter_id UUID REFERENCES letters(id) ON DELETE CASCADE,
 *     match_score INT NOT NULL CHECK(match_score BETWEEN 0 AND 100),
 *     matching_skills TEXT[] NOT NULL,
 *     missing_skills TEXT[] NOT NULL,
 *     recommendations TEXT[] NOT NULL,
 *     cv_improvements TEXT[] NOT NULL,
 *     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
 * );
 * 
 * CREATE INDEX idx_candidates_email ON candidates(email);
 * CREATE INDEX idx_letters_candidate_id ON letters(candidate_id);
 * CREATE INDEX idx_ats_analyses_letter_id ON ats_analyses(letter_id);
 */

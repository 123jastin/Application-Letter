import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Briefcase,
  FileText,
  CheckCircle,
  TrendingUp,
  User,
  MapPin,
  Sparkles,
  Globe,
  Printer,
  Edit3,
  Eye,
  Copy,
  Download,
  RotateCcw,
  History,
  UserCheck,
  Plus,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Upload,
  Info,
  Lock,
  PenTool,
  ExternalLink,
  X,
  Check,
  AlertTriangle,
  Heart,
  Settings,
  Sliders,
  Sparkle,
  Loader2
} from 'lucide-react';
import { COUNTRY_GUIDES, TargetCountry, PersonalInfo, ProfessionalInfo, JobInfo, GeneratedLetters, CountryHiringGuide } from './types';

// Regional Standards Layout Helper Types and Parsers
export interface ParsedLetter {
  applicant: string;
  date: string;
  employer: string;
  subject: string;
  salutation: string;
  body: string;
  closing: string;
  signature: string;
  isParsed: boolean;
}

export const stripComments = (str: string): string => {
  if (!str) return '';
  return str.replace(/<!--[\s\S]*?-->/g, '').trim();
};

export const stripMarkdownAndHtml = (str: string): string => {
  if (!str) return '';
  let cleaned = str.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/\*\*+/g, '');
  cleaned = cleaned.replace(/\_\_+/g, '');
  cleaned = cleaned.replace(/\*+/g, '');
  cleaned = cleaned.replace(/\_\_/g, '');
  cleaned = cleaned.replace(/<\/?[a-zA-Z0-9\s="'-]*>/g, '');
  return cleaned.trim();
};

export const getRegionalStandard = (country: string): 'East African Formal' | 'UK Professional' | 'North American ATS' | 'Gulf Professional' | 'European Corporate' => {
  if (!country) return 'East African Formal';
  if (['Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'Zambia', 'Malawi'].includes(country)) {
    return 'East African Formal';
  }
  if (['United Kingdom', 'Australia'].includes(country)) {
    return 'UK Professional';
  }
  if (['United States', 'Canada'].includes(country)) {
    return 'North American ATS';
  }
  if (['United Arab Emirates'].includes(country)) {
    return 'Gulf Professional';
  }
  return 'European Corporate';
};

export const formatAddressLines = (address: string): string[] => {
  if (!address) return [];
  const lines = address.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  return address.split(',').map(l => l.trim()).filter(Boolean);
};

export const parseLetterUncommented = (text: string): ParsedLetter => {
  const result: ParsedLetter = {
    applicant: '',
    date: '',
    employer: '',
    subject: '',
    salutation: '',
    body: text,
    closing: '',
    signature: '',
    isParsed: true
  };

  if (!text) return result;

  const lines = text.split('\n').map(l => l.trim());
  
  let subjectIdx = -1;
  const subjectRegex = /^(REF:|RE:|SUBJECT:|YAH:|KUT:|MAOMBI YA)/i;
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const cleanWord = lines[i].replace(/[\*\_\[\]]/g, '').trim();
    if (subjectRegex.test(cleanWord)) {
      subjectIdx = i;
      result.subject = lines[i];
      break;
    }
  }

  let salutationIdx = -1;
  const salutationWords = ['DEAR', 'NDUGU', 'TO WHOM', 'HI ', 'HELLO', 'MHE.', 'MKURUGENZI', 'MENEJA', 'SALAAM'];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const lineClean = lines[i].replace(/[\*\_\[\]]/g, '').trim();
    if (salutationWords.some(w => lineClean.toUpperCase().startsWith(w)) || (lineClean.endsWith(',') && i < 10)) {
      salutationIdx = i;
      result.salutation = lines[i];
      break;
    }
  }

  let closingIdx = -1;
  const closingWords = ['SINCERELY', 'FAITHFULLY', 'KIND REGARDS', 'BEST REGARDS', 'WAKO', 'ASANTE', 'WAKO ATIKA', 'WAKO UAMINIFU'];
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
    const lineClean = lines[i].replace(/[\*\_\[\]]/g, '').trim();
    if (closingWords.some(w => lineClean.toUpperCase().includes(w)) || (lines[i].endsWith(',') && i > lines.length - 6)) {
      closingIdx = i;
      result.closing = lines[i];
      break;
    }
  }

  if (salutationIdx !== -1) {
    const employerIdxEnd = subjectIdx !== -1 ? Math.min(subjectIdx, salutationIdx) : salutationIdx;
    const candidateLinesCount = Math.max(0, employerIdxEnd - 3);
    result.employer = lines.slice(candidateLinesCount, employerIdxEnd).filter(Boolean).join('\n');
  }

  const dateRegex = /\b\d{1,2}(st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/i;
  const dateMatchResult = text.match(dateRegex);
  if (dateMatchResult) {
    result.date = dateMatchResult[0];
  } else {
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      if (/\d{4}/.test(lines[i])) {
        result.date = lines[i];
        break;
      }
    }
  }

  const bodyStart = Math.max(subjectIdx, salutationIdx) + 1;
  const bodyEnd = closingIdx !== -1 ? closingIdx : lines.length - 2;
  if (bodyStart < bodyEnd) {
    result.body = lines.slice(bodyStart, bodyEnd).join('\n').trim();
  } else {
    result.body = text;
  }

  if (closingIdx !== -1) {
    result.signature = lines.slice(closingIdx + 1).join('\n').trim();
  }

  return result;
};

export const parseLetterText = (text: string): ParsedLetter => {
  const result: ParsedLetter = {
    applicant: '',
    date: '',
    employer: '',
    subject: '',
    salutation: '',
    body: text,
    closing: '',
    signature: '',
    isParsed: false
  };

  if (!text) return result;

  const hasApplicant = text.includes('<!-- SECTION_APPLICANT -->');
  const hasBody = text.includes('<!-- SECTION_BODY -->');

  if (!hasApplicant && !hasBody) {
    return parseLetterUncommented(text);
  }

  const sections = [
    { key: 'applicant', tag: '<!-- SECTION_APPLICANT -->' },
    { key: 'date', tag: '<!-- SECTION_DATE -->' },
    { key: 'employer', tag: '<!-- SECTION_EMPLOYER -->' },
    { key: 'subject', tag: '<!-- SECTION_SUBJECT -->' },
    { key: 'salutation', tag: '<!-- SECTION_SALUTATION -->' },
    { key: 'body', tag: '<!-- SECTION_BODY -->' },
    { key: 'closing', tag: '<!-- SECTION_CLOSING -->' },
    { key: 'signature', tag: '<!-- SECTION_SIGNATURE -->' }
  ];

  let currentString = text;
  
  for (let i = 0; i < sections.length; i++) {
    const currentSection = sections[i];
    const startIndex = currentString.indexOf(currentSection.tag);
    if (startIndex !== -1) {
      let nextIndex = -1;
      for (let j = i + 1; j < sections.length; j++) {
        const nextTagIndex = currentString.indexOf(sections[j].tag);
        if (nextTagIndex !== -1 && (nextIndex === -1 || nextTagIndex < nextIndex)) {
          nextIndex = nextTagIndex;
        }
      }

      const contentStart = startIndex + currentSection.tag.length;
      let rawContent = '';
      if (nextIndex !== -1) {
        rawContent = currentString.substring(contentStart, nextIndex);
      } else {
        rawContent = currentString.substring(contentStart);
      }
      
      result[currentSection.key as keyof Omit<ParsedLetter, 'isParsed'>] = rawContent.trim();
      result.isParsed = true;
    }
  }

  return result;
};

export default function App() {
  const [activeStep, setActiveStep] = useState<number>(0);

  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    signatureText: '',
    signatureImage: ''
  });

  // Personal address structured fields
  const [personalPOBox, setPersonalPOBox] = useState<string>('');
  const [personalCity, setPersonalCity] = useState<string>('');
  const [personalRegion, setPersonalRegion] = useState<string>('');

  const [professionalInfo, setProfessionalInfo] = useState<ProfessionalInfo>({
    highestEducation: '', // Empty by default
    yearsOfExperience: '0', // 0 by default
    keySkills: '',
    currentPosition: 'Jobseeker'
  });

  const [jobInfo, setJobInfo] = useState<JobInfo>({
    jobTitle: '',
    companyName: '',
    companyAddress: '',
    jobDescription: '',
    jobUrl: ''
  });

  // Company address structured fields
  const [companyPOBox, setCompanyPOBox] = useState<string>('');
  const [companyDistrict, setCompanyDistrict] = useState<string>('');
  const [companyRegion, setCompanyRegion] = useState<string>('');
  const [companyCountry, setCompanyCountry] = useState<string>('Tanzania');

  const [targetCountry, setTargetCountry] = useState<TargetCountry>('Tanzania');
  const [targetLanguage, setTargetLanguage] = useState<'English' | 'Swahili'>('English');

  const [originalApplication, setOriginalApplication] = useState<string>('');
  const [originalCover, setOriginalCover] = useState<string>('');

  const [isFetchingUrl, setIsFetchingUrl] = useState<boolean>(false);
  const [urlFetchError, setUrlFetchError] = useState<string>('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatorStages, setGeneratorStages] = useState<string>('');
  const [generatedResult, setGeneratedResult] = useState<GeneratedLetters | null>(null);

  const [activeTab, setActiveTab] = useState<'application' | 'cover'>('application');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedApplication, setEditedApplication] = useState<string>('');
  const [editedCover, setEditedCover] = useState<string>('');
  const [copiedState, setCopiedState] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string>('');

  const [layoutConfig, setLayoutConfig] = useState({
    marginSize: 'compact' as 'compact' | 'standard' | 'wide',
    fontSize: 'small' as 'small' | 'medium' | 'large',
    signatureType: 'typed' as 'typed' | 'uploaded',
    accentColor: '#0B5ED7',
    signatureSlant: '-rotate-3',
    signatureColor: 'text-blue-900'
  });

  const [letterHistory, setLetterHistory] = useState<GeneratedLetters[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Payment states
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'failed' | null>(null);
  const [paymentRef, setPaymentRef] = useState<string>('');

  // Keep personalInfo.address in sync with structured fields
  useEffect(() => {
    const fullAddress = [
      personalPOBox ? `P.O. Box ${personalPOBox}` : '',
      personalCity,
      personalRegion,
    ].filter(Boolean).join(', ');
    
    if (fullAddress && fullAddress !== personalInfo.address) {
      setPersonalInfo(prev => ({ ...prev, address: fullAddress }));
    }
  }, [personalPOBox, personalCity, personalRegion]);

  // Auto-save ALL form data to localStorage
  useEffect(() => {
    const formData = {
      personalInfo,
      personalPOBox,
      personalCity,
      personalRegion,
      professionalInfo,
      jobInfo,
      companyPOBox,
      companyDistrict,
      companyRegion,
      companyCountry,
      targetCountry,
      targetLanguage,
      layoutConfig,
    };
    localStorage.setItem('jr_all_form_data', JSON.stringify(formData));
  }, [
    personalInfo, personalPOBox, personalCity, personalRegion,
    professionalInfo, jobInfo, companyPOBox, companyDistrict,
    companyRegion, companyCountry, targetCountry, targetLanguage, layoutConfig
  ]);

  // Load baseline values from localStorage and cloud
  useEffect(() => {
    // Restore all form data
    const savedFormData = localStorage.getItem('jr_all_form_data');
    if (savedFormData) {
      try {
        const data = JSON.parse(savedFormData);
        if (data.personalInfo) setPersonalInfo(data.personalInfo);
        if (data.personalPOBox) setPersonalPOBox(data.personalPOBox);
        if (data.personalCity) setPersonalCity(data.personalCity);
        if (data.personalRegion) setPersonalRegion(data.personalRegion);
        if (data.professionalInfo) setProfessionalInfo(data.professionalInfo);
        if (data.jobInfo) setJobInfo(data.jobInfo);
        if (data.companyPOBox) setCompanyPOBox(data.companyPOBox);
        if (data.companyDistrict) setCompanyDistrict(data.companyDistrict);
        if (data.companyRegion) setCompanyRegion(data.companyRegion);
        if (data.companyCountry) setCompanyCountry(data.companyCountry);
        if (data.targetCountry) setTargetCountry(data.targetCountry);
        if (data.targetLanguage) setTargetLanguage(data.targetLanguage);
        if (data.layoutConfig) setLayoutConfig(data.layoutConfig);
      } catch (e) {
        console.error("Failed to restore form data");
      }
    }

    // Restore letter history
    const savedHistory = localStorage.getItem('jr_letters_history');
    if (savedHistory) {
      try {
        setLetterHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history");
      }
    }

    // Load cloud history
    const savedInfo = localStorage.getItem('jr_all_form_data');
    if (savedInfo) {
      try {
        const data = JSON.parse(savedInfo);
        if (data.personalInfo?.email) {
          fetchLetterHistory(data.personalInfo.email);
        }
      } catch (e) {}
    }
  }, []);

  // Check for payment return on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('payment') === 'success') {
      const pendingPayment = localStorage.getItem('jr_pending_payment');
      if (pendingPayment === 'true') {
        localStorage.removeItem('jr_pending_payment');
        setPaymentStatus('paid');
        setPaymentRef(urlParams.get('ref') || '');
        window.history.replaceState({}, '', window.location.pathname);
        
        // Auto-generate after successful payment
        setTimeout(() => {
          handleGenerateLetters();
        }, 500);
      }
    } else if (urlParams.get('payment') === 'failed') {
      setPaymentStatus('failed');
      localStorage.removeItem('jr_pending_payment');
      window.history.replaceState({}, '', window.location.pathname);
      toastError('Payment was not completed. Please try again.');
    } else if (urlParams.get('payment') === 'error') {
      setPaymentStatus('failed');
      localStorage.removeItem('jr_pending_payment');
      window.history.replaceState({}, '', window.location.pathname);
      toastError('Payment error occurred. Please try again.');
    }
  }, []);

  const activeStandard = generatedResult?.regionalStandard || getRegionalStandard(generatedResult?.request?.targetCountry || targetCountry);

  const savePersonalInfoLocally = (info: PersonalInfo) => {
    setPersonalInfo(info);
    localStorage.setItem('jr_personal_info', JSON.stringify(info));
  };

  const fetchLetterHistory = async (email: string) => {
    try {
      const candidateRes = await fetch(`/api/candidates?email=${encodeURIComponent(email)}`);
      if (candidateRes.ok) {
        const { candidate } = await candidateRes.json();
        if (candidate) {
          const lettersRes = await fetch(`/api/letters?candidateId=${candidate.id}`);
          if (lettersRes.ok) {
            const { letters } = await lettersRes.json();
            const cloudLetters = letters.map((l: any) => ({
              id: l.id,
              createdAt: l.created_at,
              request: {
                personalInfo: personalInfo,
                professionalInfo: professionalInfo,
                jobInfo: {
                  jobTitle: l.title || '',
                  companyName: l.company_name || '',
                  jobDescription: l.description || '',
                },
                targetCountry: l.target_country || 'Tanzania',
              },
              applicationLetter: l.application_letter_text,
              coverLetter: l.cover_letter_text,
              atsAnalysis: {
                matchScore: l.match_score || 70,
                matchingSkills: l.matching_skills || [],
                missingSkills: l.missing_skills || [],
                recommendations: l.recommendations || [],
                cvImprovements: l.cv_improvements || [],
              },
              regionalStandard: l.regional_standard || 'East African Formal',
              employerCountry: l.employer_country || 'Tanzania',
            }));
            
            setLetterHistory(prev => {
              const existingIds = new Set(prev.map(h => h.id));
              const newItems = cloudLetters.filter((cl: any) => !existingIds.has(cl.id));
              return [...newItems, ...prev].slice(0, 50);
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to load cloud history', err);
    }
  };

  const saveCandidateToCloud = async () => {
    try {
      await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: personalInfo.email,
          fullName: personalInfo.fullName,
          phone: personalInfo.phone,
          address: personalInfo.address,
          highestEducation: professionalInfo.highestEducation,
          yearsOfExperience: parseInt(professionalInfo.yearsOfExperience) || 0,
          currentPosition: professionalInfo.currentPosition,
          keySkills: professionalInfo.keySkills.split(',').map(s => s.trim()).filter(Boolean),
          signatureText: personalInfo.signatureText,
          signatureImage: personalInfo.signatureImage,
        })
      });
    } catch (err) {
      console.error('Failed to save candidate profile', err);
    }
  };

  const saveLetterToCloud = async (letter: GeneratedLetters) => {
    try {
      await saveCandidateToCloud();
      
      const response = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateEmail: personalInfo.email,
          title: letter.request.jobInfo.jobTitle,
          companyName: letter.request.jobInfo.companyName,
          description: letter.request.jobInfo.jobDescription,
          targetCountry: letter.request.targetCountry,
          applicationLetterText: letter.applicationLetter,
          coverLetterText: letter.coverLetter,
          matchScore: letter.atsAnalysis.matchScore,
          matchingSkills: letter.atsAnalysis.matchingSkills,
          missingSkills: letter.atsAnalysis.missingSkills,
          recommendations: letter.atsAnalysis.recommendations,
          cvImprovements: letter.atsAnalysis.cvImprovements,
          regionalStandard: letter.regionalStandard || getRegionalStandard(letter.request.targetCountry),
          employerCountry: letter.employerCountry || letter.request.targetCountry,
        })
      });
      
      if (!response.ok) {
        console.error('Failed to save letter to cloud');
      }
    } catch (err) {
      console.error('Failed to save letter to cloud', err);
    }
  };

  const toastSuccess = (msg: string) => {
    const notification = document.createElement('div');
    notification.className = "fixed bottom-5 right-5 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-xl font-medium transition-all duration-300 flex items-center space-x-2 animate-bounce";
    notification.innerHTML = `<span>⚡</span> <span>${msg}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.remove();
    }, 4000);
  };

  const toastError = (msg: string) => {
    const notification = document.createElement('div');
    notification.className = "fixed bottom-5 right-5 z-50 bg-red-600 text-white px-4 py-3 rounded-lg shadow-xl font-medium transition-all duration-300 flex items-center space-x-2 animate-pulse";
    notification.innerHTML = `<span>⚠️</span> <span>${msg}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.remove();
    }, 4000);
  };

  const handleSignatureDrag = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDraggingFile(true);
    } else {
      setIsDraggingFile(false);
    }
  };

  const handleSignatureDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSignatureFile(e.dataTransfer.files[0]);
    }
  };

  const handSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSignatureFile(e.target.files[0]);
    }
  };

  const processSignatureFile = (file: File) => {
    if (!file.type.match('image.*')) {
      alert('Please upload an image file (PNG, JPG, SVG) representing your signature');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const base64Uri = event.target.result as string;
        const updated = { ...personalInfo, signatureImage: base64Uri };
        savePersonalInfoLocally(updated);
        setLayoutConfig(prev => ({ ...prev, signatureType: 'uploaded' }));
        toastSuccess('Signature scan uploaded successfully');
      }
    };
    reader.readAsDataURL(file);
  };

  const clearSignatureImage = () => {
    const updated = { ...personalInfo, signatureImage: '' };
    savePersonalInfoLocally(updated);
    setLayoutConfig(prev => ({ ...prev, signatureType: 'typed' }));
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};
    
    if (step === 0) {
      if (!personalInfo.fullName.trim()) errors.fullName = 'Full Name is required';
      if (!personalInfo.email.trim()) {
        errors.email = 'Email Address is required';
      } else if (!/\S+@\S+\.\S+/.test(personalInfo.email)) {
        errors.email = 'Invalid email address format';
      }
      if (!personalInfo.phone.trim()) errors.phone = 'Phone number is required';
      if (!personalPOBox.trim()) errors.poBox = 'P.O. Box number is required';
      if (!personalCity.trim()) errors.city = 'City is required';
      if (!personalRegion.trim()) errors.region = 'Region is required';
    }

    if (step === 2) {
      if (!jobInfo.jobTitle.trim()) errors.jobTitle = 'Target Job Title is required';
      if (!jobInfo.companyName.trim()) errors.companyName = 'Company name is required';
      if (!jobInfo.jobDescription.trim() || jobInfo.jobDescription.length < 20) {
        errors.jobDescription = 'Please provide a valid job description (min 20 characters) to analyze';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevStep = () => {
    setActiveStep(prev => prev - 1);
    window.scrollTo(0, 0);
  };

  const handleScrapeJobUrl = async () => {
    if (!jobInfo.jobUrl.trim()) {
      setUrlFetchError('Please enter a valid job listing URL first.');
      return;
    }
    
    setIsFetchingUrl(true);
    setUrlFetchError('');
    try {
      const response = await fetch('/api/scrape-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: jobInfo.jobUrl })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to analyze that listing with AI. Please set manually.');
      }

      const data = await response.json();
      setJobInfo({
        jobTitle: data.jobTitle || jobInfo.jobTitle,
        companyName: data.companyName || jobInfo.companyName,
        companyAddress: data.companyAddress || jobInfo.companyAddress,
        jobDescription: data.jobDescription || jobInfo.jobDescription,
        jobUrl: jobInfo.jobUrl
      });
      
      setFormErrors(prev => ({
        ...prev,
        jobTitle: '',
        companyName: '',
        jobDescription: ''
      }));

    } catch (err: any) {
      setUrlFetchError(err.message || 'Scrape operation failed. Please copy-paste manually.');
    } finally {
      setIsFetchingUrl(false);
    }
  };


const handlePaymentAndGenerate = async () => {
  if (!validateStep(0) || !validateStep(2)) {
    setActiveStep(0);
    return;
  }

  setIsGenerating(true);
  setGeneratorStages('Redirecting to PesaPal...');

  try {
    const isTanzania = targetCountry === 'Tanzania';
    const amount = isTanzania ? 1000 : 0.5;
    const currency = isTanzania ? 'TZS' : 'USD';

    const response = await fetch('/api/pesapal-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        currency: currency,
        phone: personalInfo.phone || '255000000000',
        email: personalInfo.email || 'test@test.com',
        description: 'Letter Generation',
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert('Error: ' + (result.error || 'Unknown'));
      setIsGenerating(false);
      return;
    }

    // Redirect to PesaPal
    if (result.redirect_url) {
      window.location.href = result.redirect_url;
    } else {
      alert('No redirect URL received');
      setIsGenerating(false);
    }

  } catch (err: any) {
    alert('Failed: ' + err.message);
    setIsGenerating(false);
  }
};





  const handleGenerateLetters = async () => {
    if (!validateStep(0) || !validateStep(2)) {
      setActiveStep(0);
      return;
    }

    setIsGenerating(true);
    setGeneratorStages('Scanning Job Requirements & Target Scope...');

    const intervals = [
      { text: 'Deconstructing industry context for ' + targetCountry + ' standard...', time: 1000 },
      { text: 'Cross-referencing Candidate qualifications with requested experience...', time: 2500 },
      { text: 'Writing custom high-scoring Application letter structures with action verbs...', time: 4200 },
      { text: 'Formulating personalized Cover letter with direct career storyteller pitches...', time: 6000 },
      { text: 'Running ATS parsing simulations to measure density scores & generate advice...', time: 7800 },
      { text: 'Applying layout formats and prepping professional spacing standards...', time: 9200 }
    ];

    intervals.forEach(milestone => {
      setTimeout(() => {
        setGeneratorStages(milestone.text);
      }, milestone.time);
    });

    try {
      // Filter education - don't show Standard 7, Form 4, Form 6, High School
      const lowEducation = ['standard 7', 'standard seven', 'form 4', 'form four', 
        'form 6', 'form six', 'high school', 'high-school', 'secondary', 'o-level', 'a-level'];

      const educationToShow = lowEducation.some(term => 
        professionalInfo.highestEducation.toLowerCase().includes(term)
      ) ? '' : professionalInfo.highestEducation;

      // Build company address from structured fields
      const structuredCompanyAddress = [
        companyPOBox ? `P.O. Box ${companyPOBox}` : '',
        companyDistrict,
        companyRegion,
        companyCountry,
      ].filter(Boolean).join(', ');

      // Use structured address if available, otherwise fallback to jobInfo.companyAddress
      const finalCompanyAddress = structuredCompanyAddress || jobInfo.companyAddress;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalInfo,
          professionalInfo: {
            ...professionalInfo,
            highestEducation: educationToShow,
          },
          jobInfo: {
            ...jobInfo,
            companyAddress: finalCompanyAddress,
          },
          targetCountry,
          targetLanguage
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to communicate with AI generation endpoint.');
      }

      const parsedResult = await response.json();

      const sessionResult: GeneratedLetters = {
        id: parsedResult.id || 'letter_' + Date.now(),
        createdAt: parsedResult.createdAt || new Date().toISOString(),
        request: {
          personalInfo,
          professionalInfo,
          jobInfo,
          targetCountry
        },
        applicationLetter: parsedResult.applicationLetter,
        coverLetter: parsedResult.coverLetter,
        atsAnalysis: parsedResult.atsAnalysis,
        employerCountry: parsedResult.employerCountry,
        regionalStandard: parsedResult.regionalStandard
      };

      setGeneratedResult(sessionResult);
      setOriginalApplication(parsedResult.applicationLetter);
      setOriginalCover(parsedResult.coverLetter);
      setEditedApplication(parsedResult.applicationLetter);
      setEditedCover(parsedResult.coverLetter);

      const updatedHistory = [sessionResult, ...letterHistory];
      setLetterHistory(updatedHistory);
      localStorage.setItem('jr_letters_history', JSON.stringify(updatedHistory));

      if (personalInfo.email) {
        await saveLetterToCloud(sessionResult);
      }

      setIsGenerating(false);
      setActiveStep(4);
      toastSuccess('Application Letters Prepared Successfully!');

    } catch (err: any) {
      console.error(err);
      setIsGenerating(false);
      alert('AI Generation Error: ' + err.message);
    }
  };

  const handleRestoreLetter = (historyItem: GeneratedLetters) => {
    setGeneratedResult(historyItem);
    setPersonalInfo(historyItem.request.personalInfo);
    setProfessionalInfo(historyItem.request.professionalInfo);
    setJobInfo(historyItem.request.jobInfo);
    setTargetCountry(historyItem.request.targetCountry);
    
    setEditedApplication(historyItem.applicationLetter);
    setEditedCover(historyItem.coverLetter);
    
    setActiveStep(4);
    setShowHistoryDrawer(false);
    toastSuccess('Loaded application record successfully');
  };

  const handleDeleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this archived letter from history?')) {
      const filtered = letterHistory.filter(item => item.id !== id);
      setLetterHistory(filtered);
      localStorage.setItem('jr_letters_history', JSON.stringify(filtered));
      
      try {
        await fetch(`/api/letters?id=${id}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete from cloud', err);
      }
      
      toastSuccess('Deleted archived letter');
    }
  };

  const copyLetterToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  const downloadPlainText = (text: string, title: string) => {
    const cleanText = stripMarkdownAndHtml(text);
    const blob = new Blob([cleanText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Direct auto-download PDF without prompt, with candidate name
  const downloadPDFDocument = async () => {
    const element = document.getElementById('printable-area');
    if (!element) {
      toastError('Could not locate printable letter sheet');
      return;
    }

    try {
      setSaveFeedback('Generating PDF...');

      const originalBoxShadow = element.style.boxShadow;
      const originalBorder = element.style.border;
      const originalOverflow = element.style.overflow;
      
      element.style.boxShadow = 'none';
      element.style.border = 'none';
      element.style.overflow = 'hidden';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: 1123,
      });

      element.style.boxShadow = originalBoxShadow;
      element.style.border = originalBorder;
      element.style.overflow = originalOverflow;

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgRatio = canvas.height / canvas.width;
      const pageRatio = pdfHeight / pdfWidth;

      let finalWidth = pdfWidth;
      let finalHeight = pdfWidth * imgRatio;

      if (finalHeight > pdfHeight) {
        finalHeight = pdfHeight;
        finalWidth = pdfHeight / imgRatio;
      }

      const x = (pdfWidth - finalWidth) / 2;
      const y = 0;

      pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight, undefined, 'FAST');

      const letterType = activeTab === 'application' ? 'Application_Letter' : 'Cover_Letter';
      const safeName = (personalInfo.fullName || 'Candidate')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '');
      const filename = `${safeName}_${letterType}.pdf`;

      pdf.save(filename);

      setSaveFeedback(`PDF "${filename}" downloaded! ✓`);
      setTimeout(() => setSaveFeedback(''), 4000);
    } catch (err) {
      console.error('PDF failed:', err);
      setSaveFeedback('Generating PDF via print fallback...');
      setTimeout(() => {
        window.print();
        setSaveFeedback('');
      }, 1000);
    }
  };

  const handlePrintDocument = () => {
    window.print();
  };

  const getMarginStyle = () => {
    switch (layoutConfig.marginSize) {
      case 'compact': return 'py-8 px-10';
      case 'wide': return 'py-14 px-18';
      default: return 'py-10 px-14';
    }
  };

  const getFontSizeStyle = () => {
    switch (layoutConfig.fontSize) {
      case 'small': return 'text-[15px] leading-[1.5] text-slate-900 font-normal';
      case 'large': return 'text-[17px] leading-[1.6] text-slate-900 font-normal';
      default: return 'text-[14px] leading-[1.5] text-slate-900 font-normal';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#198754] stroke-[#198754] bg-green-50 border-green-100';
    if (score >= 60) return 'text-amber-600 stroke-amber-500 bg-amber-50 border-amber-100';
    return 'text-red-600 stroke-red-600 bg-red-50 border-red-100';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased">
      
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-18 flex items-center justify-between">
          
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#0B5ED7] rounded-lg flex items-center justify-center text-white font-bold text-xl font-sans shrink-0">
              J
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-800 font-sans">
                JobsReport<span className="text-[#0B5ED7]">.online</span>
              </span>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase -mt-1 font-sans">
                Professional Letter Hub
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            
            <button
              onClick={() => setShowHistoryDrawer(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white text-slate-750 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
              title="View archived letters"
              id="history-btn-navbar"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">My Saved Letters</span>
              {letterHistory.length > 0 && (
                <span className="bg-[#0B5ED7] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1">
                  {letterHistory.length}
                </span>
              )}
            </button>

            <a
              href="https://jobsreport.online"
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex items-center space-x-1 px-3 py-1.5 border border-transparent hover:border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all"
            >
              <span>Back to Jobs Portal</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col no-print">
        
        {activeStep < 4 && (
          <div className="mb-8 max-w-3xl mx-auto w-full">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              {[
                { label: 'Profile Details', num: '1' },
                { label: 'Background', num: '2' },
                { label: 'Job Parameters', num: '3' },
                { label: 'Target Market', num: '4' }
              ].map((step, idx) => {
                const isActive = idx === activeStep;
                const isCompleted = idx < activeStep;
                
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && <div className="hidden sm:block w-8 h-[1px] bg-slate-250"></div>}
                    <div 
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => idx <= activeStep && setActiveStep(idx)}
                    >
                      <div className={`w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-bold transition-all ${
                        isCompleted 
                          ? 'bg-[#198754] text-white' 
                          : isActive 
                            ? 'bg-[#0B5ED7] text-white ring-4 ring-blue-50' 
                            : 'border border-slate-300 text-slate-400 bg-slate-50'
                      }`}>
                        {isCompleted ? '✓' : step.num}
                      </div>
                      <span className={`text-xs font-bold transition-colors ${
                        isActive ? 'text-slate-800' : isCompleted ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col items-stretch max-w-5xl mx-auto w-full">
          
          <AnimatePresence mode="wait">
            
            {activeStep === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-10"
              >
                {/* Header with advice */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start space-x-2.5">
                    <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-extrabold text-amber-800 uppercase tracking-widest mb-1">
                        Important — Fill All Fields Carefully
                      </h3>
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        Your contact details will appear at the top of every application letter. 
                        Missing or incorrect information may cause your application to be rejected by employers. 
                        Double-check all fields before proceeding.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-b border-slate-100 pb-5 mb-6">
                  <h2 className="font-sans font-bold text-xl text-slate-800 flex items-center space-x-2">
                    <User className="w-5 h-5 text-[#0B5ED7]" />
                    <span>Personal Details</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Your contact information forms the professional letterhead on all generated documents.
                  </p>
                </div>

                {/* ─── NAME, PHONE, EMAIL ──────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                  
                  {/* Full Name */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center space-x-1">
                      <span>Full Name</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2.5 bg-slate-50 border-2 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all ${
                        formErrors.fullName ? 'border-red-400' : 'border-slate-300'
                      }`}
                      placeholder="e.g. Jastin Beda"
                      value={personalInfo.fullName}
                      onChange={(e) => {
                        const updated = { ...personalInfo, fullName: e.target.value };
                        savePersonalInfoLocally(updated);
                        if (formErrors.fullName) setFormErrors(prev => ({ ...prev, fullName: '' }));
                      }}
                    />
                    {formErrors.fullName && <p className="text-xs font-medium text-red-500 mt-1.5">{formErrors.fullName}</p>}
                  </div>

                  {/* Phone Number */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center space-x-1">
                      <span>Phone Number</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      className={`w-full px-3 py-2.5 bg-slate-50 border-2 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all ${
                        formErrors.phone ? 'border-red-400' : 'border-slate-300'
                      }`}
                      placeholder="e.g. +255 712 345 678"
                      value={personalInfo.phone}
                      onChange={(e) => {
                        const updated = { ...personalInfo, phone: e.target.value };
                        savePersonalInfoLocally(updated);
                        if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: '' }));
                      }}
                    />
                    {formErrors.phone && <p className="text-xs font-medium text-red-500 mt-1.5">{formErrors.phone}</p>}
                  </div>

                  {/* Email Address */}
                  <div className="flex flex-col md:col-span-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center space-x-1">
                      <span>Email Address</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      className={`w-full px-3 py-2.5 bg-slate-50 border-2 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all ${
                        formErrors.email ? 'border-red-400' : 'border-slate-300'
                      }`}
                      placeholder="e.g. jastin.beda@gmail.com"
                      value={personalInfo.email}
                      onChange={(e) => {
                        const updated = { ...personalInfo, email: e.target.value };
                        savePersonalInfoLocally(updated);
                        if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
                      }}
                    />
                    {formErrors.email && <p className="text-xs font-medium text-red-500 mt-1.5">{formErrors.email}</p>}
                  </div>
                </div>

                {/* ─── ADDRESS SECTION ──────────────────────────── */}
                <div className="border-t border-slate-100 pt-6 mb-6">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center space-x-2 mb-4">
                    <MapPin className="w-4 h-4 text-[#0B5ED7]" />
                    <span>Physical Address</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* P.O. Box - Numbers Only */}
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center space-x-1">
                        <span>P.O. Box</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium pointer-events-none">
                          P.O. Box
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className={`w-full pl-[72px] pr-3 py-2.5 bg-slate-50 border-2 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all ${
                            formErrors.poBox ? 'border-red-400' : 'border-slate-300'
                          }`}
                          placeholder="e.g. 1414"
                          value={personalPOBox}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setPersonalPOBox(val);
                            if (formErrors.poBox) setFormErrors(prev => ({ ...prev, poBox: '' }));
                          }}
                        />
                      </div>
                      {formErrors.poBox && <p className="text-xs font-medium text-red-500 mt-1.5">{formErrors.poBox}</p>}
                    </div>

                    {/* City */}
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center space-x-1">
                        <span>City / Town</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className={`w-full px-3 py-2.5 bg-slate-50 border-2 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all ${
                          formErrors.city ? 'border-red-400' : 'border-slate-300'
                        }`}
                        placeholder="e.g. Bukoba"
                        value={personalCity}
                        onChange={(e) => {
                          setPersonalCity(e.target.value);
                          if (formErrors.city) setFormErrors(prev => ({ ...prev, city: '' }));
                        }}
                      />
                      {formErrors.city && <p className="text-xs font-medium text-red-500 mt-1.5">{formErrors.city}</p>}
                    </div>

                    {/* Region */}
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center space-x-1">
                        <span>Region</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className={`w-full px-3 py-2.5 bg-slate-50 border-2 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all ${
                          formErrors.region ? 'border-red-400' : 'border-slate-300'
                        }`}
                        placeholder="e.g. Kagera"
                        value={personalRegion}
                        onChange={(e) => {
                          setPersonalRegion(e.target.value);
                          if (formErrors.region) setFormErrors(prev => ({ ...prev, region: '' }));
                        }}
                      />
                      {formErrors.region && <p className="text-xs font-medium text-red-500 mt-1.5">{formErrors.region}</p>}
                    </div>
                  </div>
                </div>

                {/* ─── SIGNATURE SECTION ────────────────────────── */}
                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center space-x-2 mb-4">
                    <PenTool className="w-4 h-4 text-[#198754]" />
                    <span>Letter Signature (Optional)</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Signature Text */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-1.5 block">
                        Signature Text
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7]"
                        placeholder="e.g. J. Beda"
                        value={personalInfo.signatureText || ''}
                        onChange={(e) => {
                          const updated = { ...personalInfo, signatureText: e.target.value };
                          savePersonalInfoLocally(updated);
                        }}
                      />
                      {personalInfo.signatureText && (
                        <div className="mt-3 bg-white p-3 rounded-md border border-slate-200 text-center">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Preview:</span>
                          <span className="font-signature text-3xl text-blue-900 inline-block select-none">
                            {personalInfo.signatureText}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Upload Signature */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-1.5 block">
                          Upload Signature Image
                        </span>
                        <div 
                          onDragEnter={handleSignatureDrag}
                          onDragOver={handleSignatureDrag}
                          onDragLeave={handleSignatureDrag}
                          onDrop={handleSignatureDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${
                            isDraggingFile 
                              ? 'border-[#0B5ED7] bg-blue-50' 
                              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <input 
                            ref={fileInputRef}
                            type="file" 
                            accept="image/*"
                            className="hidden"
                            onChange={handSignatureFileChange}
                          />
                          <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                          <p className="text-xs text-slate-500">
                            Drag scan here or <span className="text-[#0B5ED7] font-semibold">browse</span>
                          </p>
                        </div>
                      </div>

                      {personalInfo.signatureImage && (
                        <div className="mt-3 bg-white p-2 rounded-md border border-slate-200 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <img 
                              src={personalInfo.signatureImage} 
                              alt="Signature" 
                              className="h-9 max-w-[120px] object-contain border border-slate-100 rounded"
                            />
                            <span className="text-[10px] font-bold text-green-700 flex items-center space-x-1">
                              <Check className="w-3 h-3 text-green-600" />
                              <span>Ready</span>
                            </span>
                          </div>
                          <button
                            onClick={clearSignatureImage}
                            className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Next Button */}
                <div className="flex justify-end border-t border-slate-150 pt-6 mt-8">
                  <button
                    onClick={handleNextStep}
                    className="flex items-center space-x-1.5 bg-[#0B5ED7] hover:bg-[#044dbd] text-white px-5 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer"
                  >
                    <span>Next: Professional Background</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-10"
              >
                <div className="border-b border-slate-100 pb-5 mb-6">
                  <h2 className="font-sans font-bold text-xl text-slate-800 flex items-center space-x-2">
                    <Briefcase className="w-5 h-5 text-[#0B5ED7]" />
                    <span>Professional Background</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Select your highest academic qualification and experience. The AI targets your letters as a professional Jobseeker.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2">
                      Education Details
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all"
                      placeholder="e.g. Bachelor of Education with Special Needs — leave blank if not needed"
                      value={professionalInfo.highestEducation}
                      onChange={(e) => setProfessionalInfo({ ...professionalInfo, highestEducation: e.target.value })}
                    />
                    <p className="text-[10px] text-amber-600 mt-1.5 leading-tight font-medium">
                      This will appear in your application letter. Leave blank or write "N/A" if you don't want it shown.
                    </p>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2">
                      Years of Experience
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="range"
                        min="0"
                        max="20"
                        className="flex-1 accent-[#0B5ED7] cursor-pointer"
                        value={professionalInfo.yearsOfExperience}
                        onChange={(e) => setProfessionalInfo({ ...professionalInfo, yearsOfExperience: e.target.value })}
                      />
                      <span className="font-bold text-xs bg-blue-50 text-[#0B5ED7] px-3.5 py-1.5 border-2 border-blue-200 rounded-md">
                        {professionalInfo.yearsOfExperience} Yr{parseInt(professionalInfo.yearsOfExperience) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col md:col-span-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-1 flex items-center justify-between">
                      <span>Key Skills & Certifications (Optional)</span>
                      <span className="text-[10px] text-blue-600 font-bold normal-case font-sans">
                        Auto-aligned by AI if blank! ✨
                      </span>
                    </label>
                    <p className="text-[10px] text-slate-650 mb-2 leading-tight font-medium">
                      Provide some skills, or leave blank to automatically extract and target-match relevant competencies directly from the target job's requirements description.
                    </p>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all"
                      placeholder="e.g. React, Node.js, SQL, Team Management (comma separated)"
                      value={professionalInfo.keySkills}
                      onChange={(e) => {
                        setProfessionalInfo({ ...professionalInfo, keySkills: e.target.value });
                        if (formErrors.keySkills) setFormErrors(prev => ({ ...prev, keySkills: '' }));
                      }}
                      id="input-key-skills"
                    />
                    {formErrors.keySkills && <p className="text-xs font-medium text-red-500 mt-1.5">{formErrors.keySkills}</p>}
                    
                    {professionalInfo.keySkills.trim() && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {professionalInfo.keySkills.split(',').map((tag, idx) => {
                          const cleaned = tag.trim();
                          if (!cleaned) return null;
                          return (
                            <span key={idx} className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">
                              {cleaned}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

                <div className="flex items-center justify-between border-t border-slate-150 pt-6 mt-8">
                  <button
                    onClick={handlePrevStep}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Back
                  </button>

                  <button
                    onClick={handleNextStep}
                    className="flex items-center space-x-1.5 bg-[#0B5ED7] hover:bg-[#044dbd] text-white px-5 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer"
                    id="btn-goto-step3"
                  >
                    <span>Next: Target Job Parameters</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-10"
              >
                {/* ─── SECTION A: HIRING COMPANY INFORMATION ─────── */}
                <div className="border-b border-slate-100 pb-5 mb-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-[#0B5ED7]" />
                    </div>
                    <div>
                      <h2 className="font-sans font-bold text-lg text-slate-800">
                        Hiring Company Information
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Enter the employer's full address — each part on its own line for perfect letter formatting.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  
                  {/* Company Name */}
                  <div className="flex flex-col md:col-span-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center space-x-1">
                      <span>Company / Employer Name</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2.5 bg-slate-50 border-2 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all ${
                        formErrors.companyName ? 'border-red-400' : 'border-slate-300'
                      }`}
                      placeholder="e.g. CRDB Bank Plc"
                      value={jobInfo.companyName}
                      onChange={(e) => {
                        setJobInfo({ ...jobInfo, companyName: e.target.value });
                        if (formErrors.companyName) setFormErrors(prev => ({ ...prev, companyName: '' }));
                      }}
                    />
                    {formErrors.companyName && <p className="text-xs font-medium text-red-500 mt-1.5">{formErrors.companyName}</p>}
                  </div>

                  {/* P.O. Box - Numbers Only */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2">
                      P.O. Box
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium pointer-events-none">
                        P.O. Box
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-full pl-[72px] pr-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all"
                        placeholder="e.g. 7234"
                        value={companyPOBox}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setCompanyPOBox(val);
                        }}
                      />
                    </div>
                  </div>

                  {/* District */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2">
                      District / Area
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all"
                      placeholder="e.g. Azikiwe Street, Kijitonyama"
                      value={companyDistrict}
                      onChange={(e) => setCompanyDistrict(e.target.value)}
                    />
                  </div>

                  {/* Region / City */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2">
                      City / Region
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all"
                      placeholder="e.g. Dar es Salaam"
                      value={companyRegion}
                      onChange={(e) => setCompanyRegion(e.target.value)}
                    />
                  </div>

                  {/* Country */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all"
                      placeholder="e.g. Tanzania"
                      value={companyCountry}
                      onChange={(e) => setCompanyCountry(e.target.value)}
                    />
                  </div>
                </div>

                {/* ─── SECTION B: APPLYING JOB INFORMATION ──────── */}
                <div className="border-b border-slate-100 pb-5 mb-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-[#198754]" />
                    </div>
                    <div>
                      <h2 className="font-sans font-bold text-lg text-slate-800">
                        Applying Job Information
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Enter the position details you're targeting.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-8">
                  
                  {/* Job Title */}
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center space-x-1">
                      <span>Target Job Title</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2.5 bg-slate-50 border-2 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all ${
                        formErrors.jobTitle ? 'border-red-400' : 'border-slate-300'
                      }`}
                      placeholder="e.g. Senior Systems Developer"
                      value={jobInfo.jobTitle}
                      onChange={(e) => {
                        setJobInfo({ ...jobInfo, jobTitle: e.target.value });
                        if (formErrors.jobTitle) setFormErrors(prev => ({ ...prev, jobTitle: '' }));
                      }}
                    />
                    {formErrors.jobTitle && <p className="text-xs font-medium text-red-500 mt-1.5">{formErrors.jobTitle}</p>}
                  </div>

                </div>

                {/* ─── SECTION C: JOB DESCRIPTION ────────────────── */}
                <div className="border-b border-slate-100 pb-5 mb-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                      <Globe className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="font-sans font-bold text-lg text-slate-800">
                        Paste Job Details
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Paste the job link to auto-extract, or paste the full job description manually.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  
                  {/* Job URL with AI Import */}
                  <div className="flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                        Paste Job Link (Auto-fill with AI)
                      </label>
                      <span className="text-[10px] text-blue-600 font-bold normal-case">Read listing with AI! ⚡</span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all"
                        placeholder="e.g. https://jobsreport.online/view/nmb-developer-2"
                        value={jobInfo.jobUrl || ''}
                        onChange={(e) => setJobInfo({ ...jobInfo, jobUrl: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={handleScrapeJobUrl}
                        disabled={isFetchingUrl}
                        className={`px-4 py-2.5 rounded-md text-xs font-bold border flex items-center space-x-1.5 border-blue-200 cursor-pointer ${
                          isFetchingUrl
                            ? 'bg-slate-100 text-[#0B5ED7] border-slate-200 cursor-not-allowed'
                            : 'bg-blue-50 text-[#0B5ED7] hover:bg-blue-100'
                        }`}
                      >
                        {isFetchingUrl ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Reading...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#0B5ED7]" />
                            <span>Import with AI</span>
                          </>
                        )}
                      </button>
                    </div>
                    {urlFetchError && (
                      <p className="text-[11px] font-semibold text-rose-500 mt-1.5">{urlFetchError}</p>
                    )}
                  </div>

                  {/* Separator */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200"></div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">OR</span>
                    <div className="flex-1 h-px bg-slate-200"></div>
                  </div>

                  {/* Full Job Description */}
                  <div className="flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center space-x-1">
                        <span>Paste Full Job Description</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {jobInfo.jobDescription.length} characters
                      </span>
                    </div>
                    
                    <textarea
                      rows={7}
                      className={`w-full px-3 py-2.5 bg-slate-50 border-2 rounded-md text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all ${
                        formErrors.jobDescription ? 'border-red-400' : 'border-slate-300'
                      }`}
                      placeholder="Paste the duties, roles, skills, and eligibility requirements listed in the advertisement..."
                      value={jobInfo.jobDescription}
                      onChange={(e) => {
                        setJobInfo({ ...jobInfo, jobDescription: e.target.value });
                        if (formErrors.jobDescription) setFormErrors(prev => ({ ...prev, jobDescription: '' }));
                      }}
                    />
                    {formErrors.jobDescription && <p className="text-xs font-medium text-red-500 mt-1.5">{formErrors.jobDescription}</p>}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between border-t border-slate-150 pt-6">
                  <button
                    onClick={handlePrevStep}
                    className="px-4 py-2.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Back
                  </button>

                  <button
                    onClick={handleNextStep}
                    className="flex items-center space-x-1.5 bg-[#0B5ED7] hover:bg-[#044dbd] text-white px-6 py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer"
                  >
                    <span>Next: Country Standards</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-10"
              >
                <div className="border-b border-slate-100 pb-5 mb-6">
                  <h2 className="font-sans font-bold text-xl text-slate-800 flex items-center space-x-2">
                    <Globe className="w-5 h-5 text-[#0B5ED7]" />
                    <span>Country Recruiting Standards</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Select your target recruitment market. The AI automatically matches the local tone guides and hiring norms.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 mb-8">
                  {(Object.keys(COUNTRY_GUIDES) as TargetCountry[]).map((countryKey) => {
                    const countryData = COUNTRY_GUIDES[countryKey];
                    const isSelected = targetCountry === countryKey;
                    
                    return (
                      <button
                        key={countryKey}
                        onClick={() => setTargetCountry(countryKey)}
                        className={`p-4 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[95px] ${
                          isSelected 
                            ? 'bg-blue-50/50 border-[#0B5ED7] ring-1 ring-blue-100 shadow-xs' 
                            : 'bg-white border-slate-205 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-3xl filter drop-shadow-sm mb-1 block select-none">
                          {countryData.flag}
                        </span>
                        
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-xs text-slate-800 tracking-tight line-clamp-1">
                            {countryData.country}
                          </span>
                          
                          {isSelected && (
                            <span className="inline-flex items-center space-x-0.5 text-[9px] text-[#0B5ED7] font-bold mt-1 uppercase tracking-wider">
                              <CheckCircle className="w-2.5 h-2.5 fill-blue-100" />
                              <span>Active</span>
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {targetCountry && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8">
                    <div className="flex items-center space-x-2 text-[#0B5ED7] mb-3">
                      <Info className="w-4 h-4" />
                      <h4 className="font-sans font-bold text-xs uppercase tracking-wider">
                        {COUNTRY_GUIDES[targetCountry].country} Recruitment Rules Coach
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-slate-650">
                      
                      <div className="bg-white p-4 rounded-lg border border-slate-200">
                        <span className="font-bold uppercase text-[9px] tracking-widest text-slate-400 block mb-1">
                          RECOMMENDED SALUTATION
                        </span>
                        <p className="leading-relaxed font-semibold text-slate-800">
                          {COUNTRY_GUIDES[targetCountry].salutationStyle}
                        </p>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-slate-200">
                        <span className="font-bold uppercase text-[9px] tracking-widest text-slate-400 block mb-1">
                          STANDARD WRITING TONE
                        </span>
                        <p className="leading-relaxed">
                          {COUNTRY_GUIDES[targetCountry].tone}
                        </p>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-slate-200">
                        <span className="font-bold uppercase text-[9px] tracking-widest text-emerald-600 block mb-1">
                          CORE SECTOR FOCUS AREA
                        </span>
                        <p className="leading-relaxed text-slate-700">
                          {COUNTRY_GUIDES[targetCountry].focusArea}
                        </p>
                      </div>

                    </div>
                  </div>
                )}

                <div className="border-t border-slate-150 pt-6 mt-6 mb-8">
                  <span className="font-bold uppercase text-[10px] tracking-widest text-[#0B5ED7] block mb-2">
                    APPLICATION LETTER TARGET LANGUAGE
                  </span>
                  <p className="text-xs text-slate-500 mb-4">
                    Choose the language for the final generated output document. Our AI possesses deep corporate Kiswahili registers for official correspondence.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTargetLanguage('English')}
                      className={`p-4 border rounded-xl text-left transition-all flex items-center justify-between cursor-pointer ${
                        targetLanguage === 'English'
                          ? 'border-[#0B5ED7] bg-blue-50/40 text-blue-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 ${
                          targetLanguage === 'English' ? 'border-[#0B5ED7]' : 'border-slate-300'
                        }`}>
                          {targetLanguage === 'English' && <div className="w-2.5 h-2.5 rounded-full bg-[#0B5ED7]" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold block">English Standard</span>
                          <span className="text-[10.5px] text-slate-400 block mt-0.5">Recommended for UK, Gulf, North American & Multi-nationals</span>
                        </div>
                      </div>
                      <span className="text-xl filter drop-shadow-sm select-none">🇬🇧</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetLanguage('Swahili')}
                      className={`p-4 border rounded-xl text-left transition-all flex items-center justify-between cursor-pointer ${
                        targetLanguage === 'Swahili'
                          ? 'border-[#0B5ED7] bg-blue-50/40 text-blue-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 ${
                          targetLanguage === 'Swahili' ? 'border-[#0B5ED7]' : 'border-slate-300'
                        }`}>
                          {targetLanguage === 'Swahili' && <div className="w-2.5 h-2.5 rounded-full bg-[#0B5ED7]" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold block">Kiswahili cha Kiofisi (Swahili)</span>
                          <span className="text-[10.5px] text-slate-400 block mt-0.5">Sanifu kwa Tanzania pamoja na jumuia ya Afrika Mashariki</span>
                        </div>
                      </div>
                      <span className="text-xl filter drop-shadow-sm select-none">🇹🇿</span>
                    </button>
                  </div>
                </div>

                {/* ─── PAYMENT CARD ──────────────────────────────── */}
                <div className="border-t border-slate-150 pt-6 mt-6">
                  
                  <div className="bg-gradient-to-br from-[#0B5ED7]/5 to-blue-50 border border-[#0B5ED7]/20 rounded-2xl p-6 mb-6">
                    
                    {/* Header with Price */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-10 h-10 bg-[#0B5ED7] rounded-xl flex items-center justify-center">
                          <Lock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-slate-800">Secure Payment</h3>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Powered by PesaPal</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="bg-[#0B5ED7] text-white px-4 py-2 rounded-xl">
                          <span className="text-xl font-extrabold">
                            {targetCountry === 'Tanzania' ? 'TZS 1,000' : '$0.50'}
                          </span>
                          <span className="text-[9px] block opacity-80 font-medium">per letter</span>
                        </div>
                      </div>
                    </div>

                    {/* What You Get */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                      <div className="bg-white/80 rounded-xl p-3 flex items-center space-x-2.5">
                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-800">Application Letter</p>
                          <p className="text-[9px] text-slate-500">Professional format</p>
                        </div>
                      </div>
                      <div className="bg-white/80 rounded-xl p-3 flex items-center space-x-2.5">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Briefcase className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-800">Cover Letter</p>
                          <p className="text-[9px] text-slate-500">Companion included</p>
                        </div>
                      </div>
                      <div className="bg-white/80 rounded-xl p-3 flex items-center space-x-2.5">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-800">ATS Analysis</p>
                          <p className="text-[9px] text-slate-500">Score + tips</p>
                        </div>
                      </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="bg-white/60 rounded-xl p-4 mb-5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">
                        Pay with Mobile Money
                      </p>
                      <div className="flex items-center justify-center gap-4 flex-wrap">
                        <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                          <span className="text-lg">📱</span>
                          <span className="text-[11px] font-bold text-emerald-800">M-Pesa</span>
                        </div>
                        <div className="flex items-center space-x-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                          <span className="text-lg">📱</span>
                          <span className="text-[11px] font-bold text-blue-800">Airtel Money</span>
                        </div>
                        <div className="flex items-center space-x-1.5 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                          <span className="text-lg">📱</span>
                          <span className="text-[11px] font-bold text-purple-800">Tigo Pesa</span>
                        </div>
                        <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <span className="text-lg">💳</span>
                          <span className="text-[11px] font-bold text-slate-700">Card</span>
                        </div>
                      </div>
                    </div>
                    
{/* Phone Number for Payment */}
<div className="bg-white/60 rounded-xl p-4 mb-4">
  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
    Phone Number for Payment
  </label>
  <input
    type="tel"
    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/25 focus:border-[#0B5ED7] transition-all"
    placeholder="e.g. 255712345678"
    value={personalInfo.phone}
    onChange={(e) => {
      const updated = { ...personalInfo, phone: e.target.value };
      savePersonalInfoLocally(updated);
    }}
  />
  <p className="text-[9px] text-slate-400 mt-1.5">
    You'll receive a USSD push notification to enter your PIN
  </p>
</div>
                    {/* Security */}
                    <div className="flex items-center justify-center space-x-1.5 mb-5">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span className="text-[10px] text-slate-500 font-medium">
                        Secured by PesaPal • Your payment info is encrypted
                      </span>
                    </div>
                    

                    {/* Pay Button */}
                    <button
                      onClick={handlePaymentAndGenerate}
                      disabled={isGenerating}
                      className="w-full flex items-center justify-center space-x-2 bg-[#0B5ED7] hover:bg-[#044dbd] disabled:bg-slate-400 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer shadow-lg shadow-blue-200"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Redirecting to PesaPal...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Pay {targetCountry === 'Tanzania' ? 'TZS 1,000' : '$0.50'} & Generate Letter</span>
                        </>
                      )}
                    </button>

                    {/* Trust Badges */}
                    <div className="flex items-center justify-center space-x-4 mt-4">
                      <div className="flex items-center space-x-1">
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-[9px] text-slate-400">Instant delivery</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-[9px] text-slate-400">Download PDF</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-[9px] text-slate-400">Edit anytime</span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handlePrevStep}
                      className="px-4 py-2.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                    <div></div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {activeStep === 4 && generatedResult && (
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
          
          <div className="w-full md:w-[320px] space-y-6 flex-shrink-0 no-print" id="ats-hub-rail">
            
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-4 text-center">
                Match Index
              </span>

              <div className="flex flex-col items-center justify-center">
                
                <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                  
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="54"
                      className="stroke-slate-100 fill-transparent"
                      strokeWidth="6"
                    />
                    <motion.circle
                      cx="64"
                      cy="64"
                      r="54"
                      className={`fill-transparent ${getScoreColor(generatedResult.atsAnalysis.matchScore).split(' ')[1]}`}
                      strokeWidth="6"
                      strokeDasharray={2 * Math.PI * 54}
                      initial={{ strokeDashoffset: 2 * Math.PI * 54 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 54 * (1 - generatedResult.atsAnalysis.matchScore / 100) }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                  </svg>
                  
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold tracking-tight text-slate-800">
                      {generatedResult.atsAnalysis.matchScore}%
                    </span>
                    <span className="text-[8px] font-bold uppercase text-slate-400 tracking-wider">
                      Confidence
                    </span>
                  </div>
                </div>

                <div className={`w-full py-2 px-3 rounded text-center border text-[11px] font-bold ${getScoreColor(generatedResult.atsAnalysis.matchScore).split(' ').slice(2).join(' ')}`}>
                  {generatedResult.atsAnalysis.matchScore >= 80 
                    ? 'Excellent ATS Match ✓' 
                    : generatedResult.atsAnalysis.matchScore >= 60 
                      ? 'Moderate Optimization' 
                      : 'Needs Revision'
                  }
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              
              <div>
                <div className="flex items-center space-x-1.5 mb-2.5">
                  <CheckCircle className="w-4 h-4 text-[#198754]" />
                  <span className="text-xs font-bold text-slate-705 uppercase tracking-wider">
                    Aligned Keywords ({generatedResult.atsAnalysis.matchingSkills.length})
                  </span>
                </div>
                
                {generatedResult.atsAnalysis.matchingSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {generatedResult.atsAnalysis.matchingSkills.map((skill, idx) => (
                      <span key={idx} className="bg-slate-50 text-slate-800 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No matches detected.</p>
                )}
              </div>

              <div>
                <div className="flex items-center space-x-1.5 mb-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-705 uppercase tracking-wider">
                    Missing Target Skills ({generatedResult.atsAnalysis.missingSkills.length})
                  </span>
                </div>

                {generatedResult.atsAnalysis.missingSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {generatedResult.atsAnalysis.missingSkills.map((skill, idx) => (
                      <span key={idx} className="bg-amber-50/50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-650 font-semibold flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Fully covered!</span>
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  <span>Strategic Application Tips</span>
                </h4>
                <ul className="space-y-2 text-xs text-slate-600 pl-4 list-disc marker:text-slate-400">
                  {generatedResult.atsAnalysis.recommendations.map((tip, idx) => (
                    <li key={idx} className="leading-relaxed">{tip}</li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-slate-100 pt-3.5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#198754]" />
                  <span>CV Improvement Board</span>
                </h4>
                <ul className="space-y-2 text-xs text-slate-600 pl-4 list-disc marker:text-slate-400">
                  {generatedResult.atsAnalysis.cvImprovements.map((improvement, idx) => (
                    <li key={idx} className="leading-relaxed">{improvement}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={() => {
                if (confirm('Are you sure you want to start a brand new letter draft? This will clear the current target job parameters but preserve your personal profile so you don\'t have to re-enter it.')) {
                  setJobInfo({
                    jobTitle: '',
                    companyName: '',
                    companyAddress: '',
                    jobDescription: '',
                    jobUrl: ''
                  });
                  setCompanyPOBox('');
                  setCompanyDistrict('');
                  setCompanyRegion('');
                  setCompanyCountry('Tanzania');
                  setGeneratedResult(null);
                  setActiveStep(0);
                }
              }}
              className="w-full flex items-center justify-center space-x-1.5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Draft Another Document</span>
            </button>
            
          </div>

          <div className="flex-1 flex flex-col space-y-4">
            
            <div className="bg-[#0B5ED7]/5 border border-[#0B5ED7]/15 rounded-xl p-3.5 px-5 flex flex-wrap items-center justify-between gap-3 no-print shadow-xs">
              <div className="flex items-center space-x-2">
                <div className="bg-[#0B5ED7]/10 p-1.5 rounded-lg">
                  <Globe className="w-4 h-4 text-[#0B5ED7]" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-800">
                    Smart Layout Intelligence Active
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Hiring Destination: <span className="font-bold text-slate-700">{generatedResult?.employerCountry || generatedResult?.request?.targetCountry || targetCountry}</span> • Regional Standard applied: <span className="font-bold text-[#0B5ED7]">{generatedResult?.regionalStandard || getRegionalStandard(generatedResult?.request?.targetCountry || targetCountry)}</span>
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1 uppercase tracking-wider">
                100% ATS Friendly
              </div>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 no-print shadow-sm">
              
              <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => { setActiveTab('application'); setIsEditing(false); }}
                  className={`px-4 py-2 rounded text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    activeTab === 'application' 
                      ? 'bg-white text-[#0B5ED7] shadow-xs border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Application Letter</span>
                </button>
                
                <button
                  onClick={() => { setActiveTab('cover'); setIsEditing(false); }}
                  className={`px-4 py-2 rounded text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    activeTab === 'cover' 
                      ? 'bg-white text-[#0B5ED7] shadow-xs border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Companion Cover Letter</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                
                {isEditing && (
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to discard your manual edits and restore this letter's original draft?")) {
                        if (activeTab === 'application') {
                          setEditedApplication(stripComments(originalApplication));
                        } else {
                          setEditedCover(stripComments(originalCover));
                        }
                      }
                    }}
                    className="p-2.5 border border-orange-200 bg-orange-50 hover:bg-orange-100/85 text-orange-700 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center space-x-1"
                    title="Restore back to the original unmodified AI-generated response draft"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Draft</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (!isEditing) {
                      // Strip comments when entering edit mode so user sees clean text
                      setEditedApplication(stripComments(editedApplication));
                      setEditedCover(stripComments(editedCover));
                    } else {
                      // When exiting, strip comments again to keep it clean
                      setEditedApplication(stripComments(editedApplication));
                      setEditedCover(stripComments(editedCover));
                    }
                    setIsEditing(!isEditing);
                  }}
                  className={`p-2.5 border rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center space-x-1 ${
                    isEditing 
                      ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100' 
                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                  }`}
                >
                  {isEditing ? <Eye className="w-4 h-4 text-blue-600" /> : <Edit3 className="w-4 h-4 text-slate-500" />}
                  <span className="hidden sm:inline">{isEditing ? 'Preview' : 'Quick Edit'}</span>
                </button>

                <button
                  onClick={() => copyLetterToClipboard(activeTab === 'application' ? editedApplication : editedCover)}
                  className="px-3.5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer"
                  title="Copy formatted markdown text to clipboard"
                >
                  {copiedState ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                  <span>{copiedState ? 'Copied' : 'Copy Text'}</span>
                </button>

                {/* DIRECT PDF DOWNLOAD BUTTON */}
                <button
                  onClick={downloadPDFDocument}
                  className="px-4 py-2.5 bg-[#0B5ED7] hover:bg-[#044dbd] text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer no-print shadow-sm"
                  title="Download PDF directly"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Download PDF</span>
                </button>

                <button
                  onClick={() => {
                    setSaveFeedback('Launching browser printing stream... If nothing happens, click "Download PDF" above. ✓');
                    setTimeout(() => setSaveFeedback(''), 6000);
                    handlePrintDocument();
                  }}
                  className="px-3 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer no-print"
                  title="Launch browser print window (May be blocked in sandbox iframes)"
                >
                  <Printer className="w-4 h-4 shrink-0 text-slate-500" />
                  <span className="hidden sm:inline">Print Letter</span>
                  <span className="sm:hidden">Print</span>
                </button>

              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 no-print shadow-sm">
              <div className="flex items-center space-x-1 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold text-[10px] uppercase text-slate-500 tracking-wider">Document Settings</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400">Margins:</span>
                  <select
                    className="bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none text-slate-700 font-medium"
                    value={layoutConfig.marginSize}
                    onChange={(e) => setLayoutConfig({ ...layoutConfig, marginSize: e.target.value as any })}
                  >
                    <option value="compact">Narrow Spacing (A4 compact)</option>
                    <option value="standard">Standard Balanced</option>
                    <option value="wide">Wide Generous Padding</option>
                  </select>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400">Font Scale:</span>
                  <select
                    className="bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none text-slate-700 font-medium"
                    value={layoutConfig.fontSize}
                    onChange={(e) => setLayoutConfig({ ...layoutConfig, fontSize: e.target.value as any })}
                  >
                    <option value="small">Small Font (A4 safe density)</option>
                    <option value="medium">Standard Text (Readable)</option>
                    <option value="large">Large Premium</option>
                  </select>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400">Border:</span>
                  <div className="flex items-center space-x-1">
                    {[
                      { name: 'Classic Slate', hex: '#64748B' },
                      { name: 'Primary Blue', hex: '#0B5ED7' },
                      { name: 'Emerald Success', hex: '#198754' },
                      { name: 'Deep Gold', hex: '#B45309' }
                    ].map((colorItem) => (
                      <button
                        key={colorItem.hex}
                        onClick={() => setLayoutConfig({ ...layoutConfig, accentColor: colorItem.hex })}
                        className={`w-4 h-4 rounded-full border transition-all cursor-pointer ${
                          layoutConfig.accentColor === colorItem.hex ? 'ring-2 ring-slate-400 scale-110' : ''
                        }`}
                        style={{ backgroundColor: colorItem.hex }}
                        title={colorItem.name}
                      />
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {saveFeedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 px-4 text-emerald-850 text-xs font-semibold flex items-center justify-between no-print shadow-xs"
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveFeedback}</span>
                </div>
                <button
                  onClick={() => setSaveFeedback('')}
                  className="text-emerald-500 hover:text-emerald-700 text-sm font-bold ml-4"
                >
                  ✕
                </button>
              </motion.div>
            )}

            {isEditing && (
              <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 no-print shadow-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span>
                    <strong>Live Editing Mode:</strong> Changes inside the editor are saved instantly to your current draft.
                  </span>
                </div>
                <div className="flex items-center space-x-2.5 font-sans">
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to discard your manual edits and refresh back to the original draft?")) {
                        if (activeTab === 'application') {
                          setEditedApplication(stripComments(originalApplication));
                        } else {
                          setEditedCover(stripComments(originalCover));
                        }
                        setSaveFeedback('Original draft successfully restored! ✓');
                        setTimeout(() => setSaveFeedback(''), 4000);
                      }
                    }}
                    className="px-2.5 py-1.5 border border-amber-300 bg-white hover:bg-amber-50 text-amber-800 rounded-md font-semibold cursor-pointer transition-colors flex items-center space-x-1"
                    title="Undo all manual entries and refresh back to pristine AI generated draft"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Refresh Back</span>
                  </button>
                  <button
                    onClick={() => {
                      // Strip HTML comments from edited text before saving
                      if (activeTab === 'application') {
                        const cleaned = stripComments(editedApplication);
                        setEditedApplication(cleaned);
                      } else {
                        const cleaned = stripComments(editedCover);
                        setEditedCover(cleaned);
                      }
                      setIsEditing(false);
                      setSaveFeedback('Changes saved and preview rendered! ✓');
                      setTimeout(() => setSaveFeedback(''), 4000);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold cursor-pointer transition-colors"
                  >
                    Save & Close Editor
                  </button>
                </div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200/80 p-2 sm:p-6 rounded-xl flex justify-center items-start overflow-x-auto print-container no-scrollbar shadow-xs">
              
              {isEditing ? (
                <textarea
                  className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 border-2 border-blue-300 rounded-lg p-8 focus:outline-none focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/25 text-[15px] leading-[1.6] font-normal"
                  value={activeTab === 'application' ? editedApplication : editedCover}
                  onChange={(e) => {
                    if (activeTab === 'application') {
                      setEditedApplication(e.target.value);
                    } else {
                      setEditedCover(e.target.value);
                    }
                  }}
                  placeholder="Edit your letter here..."
                  style={{
                    fontFamily: '"Inter", sans-serif',
                    resize: 'vertical',
                  }}
                />
              ) : (
                <div 
                  id="printable-area"
                  className={`print-page w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 border border-slate-200 rounded-lg relative transition-all duration-150 flex flex-col justify-between ${getMarginStyle()} ${getFontSizeStyle()}`}
                  style={{ 
                    fontFamily: '"Inter", sans-serif',
                    borderColor: layoutConfig.accentColor,
                    borderTopWidth: '5px'
                  }}
                >
                  
                  <div className="space-y-5">
                    {(() => {
                      const activeText = activeTab === 'application' ? editedApplication : editedCover;
                      const activeStandard = generatedResult?.regionalStandard || getRegionalStandard(generatedResult?.request?.targetCountry || targetCountry);
                      const parsed = parseLetterText(activeText);
                      const cleanTextFallback = stripMarkdownAndHtml(activeText);

                      if (!parsed.isParsed) {
                        return (
                          <div className="space-y-5">
                            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                              <div>
                                <h1 className="font-display font-extrabold text-[15px] text-slate-950 leading-snug">
                                  {personalInfo.fullName}
                                </h1>
                                <p className="text-[13px] font-semibold text-slate-700 leading-tight">
                                  {professionalInfo.currentPosition}
                                </p>
                              </div>

                              <div className="text-right text-[13px] text-slate-700 space-y-0.5">
                                <p className="font-semibold text-slate-800">{personalInfo.phone}</p>
                                <p className="font-semibold text-slate-800">{personalInfo.email}</p>
                                <p className="leading-snug max-w-[220px] text-slate-700">{personalInfo.address}</p>
                              </div>
                            </div>

                            <div className="whitespace-pre-line text-slate-950 leading-[1.5] font-normal text-[13px] space-y-4">
                              {cleanTextFallback}
                            </div>
                          </div>
                        );
                      }

                      if (activeStandard === 'East African Formal') {
                        return (
                          <div className="space-y-4">
                            <div className="flex flex-col items-end text-right ml-auto max-w-[320px] text-[13px] text-slate-700 space-y-1 leading-tight">
                              <h1 className="font-sans font-bold text-[15px] text-slate-950 leading-snug">
                                {personalInfo.fullName}
                              </h1>
                              {/* Show address from parsed applicant section */}
                              {parsed.applicant && stripMarkdownAndHtml(parsed.applicant).trim().length > 0 ? (
                                stripMarkdownAndHtml(parsed.applicant).split('\n').map((line, idx) => {
                                  const trimmed = line.trim();
                                  if (!trimmed) return null;
                                  // Skip the name line (already displayed above)
                                  if (trimmed.toLowerCase() === personalInfo.fullName.toLowerCase()) return null;
                                  // Skip phone/email lines
                                  if (trimmed.includes('@') || trimmed.includes('|') || /\+\d{1,3}\s?\d{3}\s?\d{3}\s?\d{3}/.test(trimmed)) return null;
                                  return (
                                    <p key={idx} className="font-normal text-slate-800 text-[13px]">
                                      {trimmed}
                                    </p>
                                  );
                                })
                              ) : (
                                // Fallback to structured address if parsed applicant is empty
                                formatAddressLines(personalInfo.address).map((line, idx) => (
                                  <p key={idx} className="font-normal text-slate-800 text-[13px]">
                                    {line}
                                  </p>
                                ))
                              )}
                              <p className="font-normal text-slate-800 text-[13px] pt-2">
                                {stripMarkdownAndHtml(parsed.date) || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                            </div>

                            <div className="text-left max-w-[320px] text-[13px] text-slate-800 space-y-0.5 leading-snug pt-3">
                              <div className="whitespace-pre-line">{stripMarkdownAndHtml(parsed.employer)}</div>
                            </div>

                            {parsed.subject && (
                              <div className="py-1">
                                <p className="font-bold underline uppercase text-slate-950 text-[13px] text-center md:text-left leading-normal">
                                  {stripMarkdownAndHtml(parsed.subject)}
                                </p>
                              </div>
                            )}

                            <div className="text-left text-[13px] font-semibold text-slate-900">
                              {stripMarkdownAndHtml(parsed.salutation)}
                            </div>

                            <div className="whitespace-pre-line text-slate-950 leading-[1.5] font-normal text-[13px] space-y-3 pt-0.5">
                              {stripMarkdownAndHtml(parsed.body)}
                            </div>

                            <div className="pt-1 text-left text-[13px]">
                              <p className="font-semibold text-slate-900">{stripMarkdownAndHtml(parsed.closing)}</p>
                            </div>
                          </div>
                        );
                      }

                      if (activeStandard === 'UK Professional') {
                        return (
                          <div className="space-y-3 text-[13px]">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-1">
                              <div>
                                <h1 className="font-sans font-bold text-[15px] text-slate-950 tracking-tight">{personalInfo.fullName}</h1>
                                <p className="text-[13px] text-slate-700 uppercase font-bold tracking-wider">{professionalInfo.currentPosition}</p>
                              </div>
                              <div className="text-right text-[13px] text-slate-700 leading-tight">
                                <p className="text-slate-800">{personalInfo.phone} | {personalInfo.email}</p>
                                <p className="text-slate-700">{personalInfo.address}</p>
                              </div>
                            </div>

                            <div className="text-left text-slate-700 text-[13px] uppercase font-bold tracking-widest pt-1">
                              {stripMarkdownAndHtml(parsed.date)}
                            </div>

                            <div className="text-left max-w-[320px] text-[13px] text-slate-800 leading-tight pt-0.5 whitespace-pre-line">
                              {stripMarkdownAndHtml(parsed.employer)}
                            </div>

                            <div className="text-left font-semibold text-slate-900 text-[13px] pt-2">
                              {stripMarkdownAndHtml(parsed.salutation)}
                            </div>

                            <div className="whitespace-pre-line text-slate-950 leading-[1.5] font-normal text-[13px] space-y-3 pt-0.5">
                              {stripMarkdownAndHtml(parsed.body)}
                            </div>

                            <div className="pt-1 text-left">
                              <p className="font-semibold text-slate-900 text-[13px]">{stripMarkdownAndHtml(parsed.closing)}</p>
                            </div>
                          </div>
                        );
                      }

                      if (activeStandard === 'North American ATS') {
                        return (
                          <div className="space-y-3 text-[13px] font-sans tracking-normal leading-relaxed text-slate-800">
                            <div className="border-b border-slate-200 pb-3 mb-1">
                              <h1 className="font-sans font-extrabold text-[15px] text-slate-950 uppercase tracking-tight">{personalInfo.fullName}</h1>
                              <p className="text-slate-700 font-bold text-[13px]">{professionalInfo.currentPosition}</p>
                              <p className="text-slate-700 pt-1 text-[13px]">
                                {personalInfo.address} • {personalInfo.phone} • {personalInfo.email}
                              </p>
                            </div>

                            <div className="text-left text-slate-700 text-[13px]">
                              <p>{stripMarkdownAndHtml(parsed.date)}</p>
                            </div>

                            <div className="text-left max-w-[320px] text-slate-800 leading-tight pt-0.5 whitespace-pre-line text-[13px]">
                              {stripMarkdownAndHtml(parsed.employer)}
                            </div>

                            <div className="text-left font-bold text-slate-900 text-[13px] pt-1">
                              {stripMarkdownAndHtml(parsed.salutation)}
                            </div>

                            <div className="whitespace-pre-line text-slate-950 leading-[1.5] font-normal text-[13px] space-y-3 pt-0.5">
                              {stripMarkdownAndHtml(parsed.body)}
                            </div>

                            <div className="pt-1 text-left">
                              <p className="font-semibold text-slate-900 text-[13px]">{stripMarkdownAndHtml(parsed.closing)}</p>
                            </div>
                          </div>
                        );
                      }

                      if (activeStandard === 'Gulf Professional') {
                        return (
                          <div className="space-y-3 text-[13px] leading-snug">
                            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3 mb-1">
                              <div>
                                <h1 className="font-sans font-extrabold text-[15px] text-slate-950 tracking-tight">{personalInfo.fullName}</h1>
                                <p className="text-[13px] text-slate-700 uppercase font-semibold tracking-wider">{professionalInfo.currentPosition}</p>
                              </div>
                              <div className="text-right text-[13px] text-slate-700 leading-tight">
                                <p className="font-medium text-slate-800">{personalInfo.phone}</p>
                                <p className="font-medium text-slate-800">{personalInfo.email}</p>
                                <p className="text-slate-700">{personalInfo.address}</p>
                              </div>
                            </div>

                            <div className="flex justify-between items-end pt-1">
                              <div className="text-left max-w-[320px] text-slate-800 leading-tight text-[13px] whitespace-pre-line">
                                {stripMarkdownAndHtml(parsed.employer)}
                              </div>
                              <div className="text-right text-slate-700 text-[13px] font-bold">
                                {stripMarkdownAndHtml(parsed.date)}
                              </div>
                            </div>

                            {parsed.subject && (
                              <div className="py-1 border-y border-slate-100 font-bold text-slate-950 text-[13px]">
                                <p className="uppercase">{stripMarkdownAndHtml(parsed.subject)}</p>
                              </div>
                            )}

                            <div className="text-left font-bold text-slate-900 text-[13px] pt-0.5">
                              {stripMarkdownAndHtml(parsed.salutation)}
                            </div>

                            <div className="whitespace-pre-line text-slate-950 leading-[1.5] font-normal text-[13px] space-y-3 pt-0.5">
                              {stripMarkdownAndHtml(parsed.body)}
                            </div>

                            <div className="pt-1 text-left">
                              <p className="font-semibold text-slate-900 text-[13px]">{stripMarkdownAndHtml(parsed.closing)}</p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3 text-[13px] font-sans">
                          <div className="flex justify-between items-start border-b border-slate-200 pb-3 mb-1">
                            <div>
                              <h1 className="font-sans font-light text-[15px] text-slate-950 tracking-tight">{personalInfo.fullName}</h1>
                              <p className="text-[13px] text-slate-600 font-mono">{professionalInfo.currentPosition}</p>
                            </div>
                            <div className="text-right text-[13px] text-slate-700 space-y-0.5 leading-tight">
                              <p className="text-slate-800">{personalInfo.phone} | {personalInfo.email}</p>
                              <p className="max-w-[180px] leading-tight ml-auto text-slate-700">{personalInfo.address}</p>
                            </div>
                          </div>

                          <div className="text-left text-[13px] text-slate-700 font-semibold pt-1">
                            {stripMarkdownAndHtml(parsed.date)}
                          </div>

                          <div className="text-left max-w-[320px] text-slate-800 leading-tight pt-0.5 whitespace-pre-line text-[13px]">
                            {stripMarkdownAndHtml(parsed.employer)}
                          </div>

                          <div className="text-left font-semibold text-slate-900 text-[13px] pt-2">
                            {stripMarkdownAndHtml(parsed.salutation)}
                          </div>

                          <div className="whitespace-pre-line text-slate-950 leading-[1.5] font-normal text-[13px] space-y-3 pt-0.5">
                            {stripMarkdownAndHtml(parsed.body)}
                          </div>

                          <div className="pt-1 text-left">
                            <p className="font-semibold text-slate-900 text-[13px]">{stripMarkdownAndHtml(parsed.closing)}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* BOTTOM SIGNATURE BLOCK - Compact */}
                  <div className="pt-4 flex flex-col items-start space-y-0.5">
                    {layoutConfig.signatureType === 'uploaded' && personalInfo.signatureImage ? (
                      <div className="relative py-0.5">
                        <img 
                          src={personalInfo.signatureImage} 
                          alt="Manual Signature Scan" 
                          className="h-8 max-w-[120px] object-contain select-none"
                        />
                      </div>
                    ) : personalInfo.signatureText ? (
                      <div className="py-0.5 select-none transform ml-1 relative">
                        <span className={`font-signature text-2xl ${layoutConfig.signatureColor} ${layoutConfig.signatureSlant} inline-block`}>
                          {personalInfo.signatureText}
                        </span>
                      </div>
                    ) : (
                      <div className="w-24 h-4 border-b border-dashed border-slate-300 mt-1"></div>
                    )}

                    <div className="text-[13px] font-bold text-slate-950 tracking-tight leading-tight pt-0.5">
                      {personalInfo.fullName}
                    </div>
                    {activeStandard === 'East African Formal' ? (
                      <div className="text-[12px] text-slate-800 font-normal leading-tight mt-0.5 space-y-0">
                        <p>Phone: {personalInfo.phone}</p>
                        <p>Email: {personalInfo.email}</p>
                      </div>
                    ) : (
                      <div className="text-[12px] uppercase font-semibold tracking-wider text-slate-700">
                        Applicant Profile
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>

            <div className="bg-emerald-50 border border-emerald-100 text-[11.5px] rounded-xl p-4 text-slate-600 flex items-start space-x-2.5 no-print">
              <Info className="w-5 h-5 text-[#198754] flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">Pro-Tip for exact A4 PDF downloads:</span>
                <p className="leading-relaxed mt-0.5">
                  Click the <span className="font-bold text-[#0B5ED7]">Download PDF</span> button for instant auto-download with your name in the filename. No extra steps needed!
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <div className="max-w-md w-full bg-white border border-slate-250 rounded-xl p-8 text-center shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#0B5ED7]"></div>
              
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-slate-100 border-t-2 border-t-[#0B5ED7] animate-spin"></div>
                </div>
              </div>

              <h3 className="font-sans font-bold text-slate-900 text-base mb-1 tracking-tight">
                JobsReport Document Studio
              </h3>
              <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mb-6 flex items-center justify-center space-x-1">
                <span>Model: {paymentStatus === 'paid' ? 'Generating your letter...' : 'Gemini 2.5 Flash'}</span>
              </p>

              <div className="min-h-[44px] px-4 py-3 rounded bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center justify-center space-x-2 leading-relaxed">
                <span className="animate-pulse font-medium">{generatorStages}</span>
              </div>

              <p className="text-[9px] text-slate-400 mt-6 leading-relaxed uppercase tracking-widest font-bold">
                Tailoring physical correspondence layouts...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistoryDrawer && (
          <div className="fixed inset-0 z-40 overflow-hidden no-print">
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryDrawer(false)}
              className="absolute inset-0 bg-slate-900"
            />

            <div className="absolute inset-y-0 right-0 max-w-sm w-full bg-white shadow-xl flex flex-col justify-between border-l border-slate-200">
              
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <History className="w-4 h-4 text-[#0B5ED7]" />
                  <h3 className="font-sans font-bold text-slate-805 text-sm tracking-tight">Letter Archive</h3>
                </div>
                
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <input
                  type="text"
                  placeholder="Search by company or job title..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:border-slate-400 focus:outline-none bg-white text-slate-750"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/20">
                {letterHistory.filter(item => 
                  item.request.jobInfo.companyName.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                  item.request.jobInfo.jobTitle.toLowerCase().includes(historySearchQuery.toLowerCase())
                ).length > 0 ? (
                  letterHistory.filter(item => 
                    item.request.jobInfo.companyName.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                    item.request.jobInfo.jobTitle.toLowerCase().includes(historySearchQuery.toLowerCase())
                  ).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleRestoreLetter(item)}
                      className="bg-white border border-slate-200 hover:border-slate-300 p-4 rounded-lg shadow-xs transition-all cursor-pointer flex flex-col justify-between min-h-[105px]"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#0B5ED7]">
                            {item.request.targetCountry}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium font-mono">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <h4 className="font-bold text-xs text-slate-850 leading-snug line-clamp-1">{item.request.jobInfo.jobTitle}</h4>
                        <p className="text-[10px] font-semibold text-slate-500 leading-tight block">{item.request.jobInfo.companyName}</p>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                        <span className="text-[9px] font-bold text-slate-650 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded flex items-center space-x-0.5">
                          <span>Confidence Score:</span>
                          <span className="font-extrabold text-slate-800">{item.atsAnalysis.matchScore}%</span>
                        </span>

                        <button
                          onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                          className="text-slate-400 hover:text-red-600 hover:bg-slate-50 p-1 rounded transition-colors"
                          title="Archive letter delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-14 flex flex-col items-center justify-center text-slate-400">
                    <FileText className="w-8 h-8 text-slate-300 stroke-1 mb-2" />
                    <p className="text-xs font-semibold">No archived applications found.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Generate letters, or type query keyword matches above.</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                JobsReport database persistent archive storage
              </div>

            </div>
          </div>
        )}
      </AnimatePresence>

      <footer className="no-print bg-slate-900 border-t border-slate-800 text-slate-400 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-1 mb-2">
              <span className="font-display font-extrabold text-lg text-white">JobsReport</span>
              <span className="text-[#198754] font-bold text-lg">.online</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              The premium career builder empowering Tanzanian, East-African, and international professionals to write perfect ATS compliant application documents.
            </p>
          </div>

          <div className="text-center md:text-right space-y-1 text-xs">
            <p className="font-semibold text-slate-300">&#169; 2026 JobsReport.online Letter Studio</p>
            <p className="text-slate-500 font-medium">Safe & secure server-side encryption protects candidate data</p>
            <div className="flex items-center justify-center md:justify-end gap-1 text-[11px] text-pink-700 font-bold uppercase tracking-wider mt-3">
              <span>Made with</span>
              <Heart className="w-3 h-3 fill-pink-700 stroke-none" />
              <span>for career growth</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}

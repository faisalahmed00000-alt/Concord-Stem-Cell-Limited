export interface FollowUp {
  id: string;
  date: string;
  status: string;
  notes: string;
  clinician: string;
  sessionNo?: number;
  treatmentSessionNo?: number;
  attachments?: PatientAttachment[];
}

export interface TreatmentSession {
  id: string;
  sessionNo: number;
  date: string;
  consultant: string;
  treatment: string;
  route: string;
  procedurePlace?: string;
  amount: string;
  notes?: string;
  createdAt: string;
}

export interface PatientAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64 encoded string
  uploadedAt: string;
}

export interface Patient {
  id: string; // Internal UUID
  code: string; // Patient Code
  name: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  phone: string;
  diagnosis: string;
  consultant: string;
  treatment: string;
  route: string; // Route of administration
  procedurePlace?: string; // Procedure place
  amount: string; // Amount of product
  sessionNo: number;
  date: string; // Entry Date
  improvement: 'Significantly Improved' | 'Improved' | 'Stable' | 'Deteriorated' | 'Unchanged';
  notes: string;
  followUps: FollowUp[];
  treatmentSessions?: TreatmentSession[];
  createdAt: string;
  requiresFollowUp?: boolean; // Controls whether this patient generates scheduler items
  attachments?: PatientAttachment[];
  profilePic?: string; // Base64 encoded profile image
  submittedBy?: string; // Name of clinician who created the profile
  lastEditedBy?: string; // Name of clinician who last edited the profile
}

export interface UserSession {
  username: string;
  key: CryptoKey; // Symmetric key for in-memory decryption
}

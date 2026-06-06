import { Patient } from '../types/patient';
import { deriveKey, encrypt, decrypt, generateSalt } from './crypto';

export interface DriveFileMetadata {
  id: string;
  name: string;
  createdTime?: string;
  webViewLink?: string;
  size?: number;
}

/**
 * Searches for or creates a private folder named "Concord Secure Clinical Backups" on Google Drive.
 */
export async function getOrCreatePrivateFolder(accessToken: string): Promise<string | null> {
  const folderName = 'Concord Secure Clinical Backups';
  const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`;

  try {
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }

    // Not found, create it
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        description: 'Private secure vault for clinical records storage.'
      }),
    });

    if (createResponse.ok) {
      const createData = await createResponse.json();
      return createData.id;
    }
  } catch (err) {
    console.error('[Drive-Folder] Failed to get or create private clinical folder:', err);
  }

  return null;
}

/**
 * Creates and uploads an encrypted clinical database backup to the private folder in the user's Google Drive.
 */
export async function backupDatabaseToDrive(
  accessToken: string,
  patients: Patient[],
  fileName: string,
  passphrase?: string
): Promise<DriveFileMetadata> {
  // 1. Resolve private folder target ID or fallback to root
  const folderId = await getOrCreatePrivateFolder(accessToken);

  // 2. Encrypt the serialized records if a passphrase is provided
  let finalPayloadStr: string;
  if (passphrase && passphrase.trim()) {
    const salt = generateSalt();
    const derived = await deriveKey(passphrase.trim(), salt);
    const textData = JSON.stringify(patients);
    const encrypted = await encrypt(textData, derived);

    finalPayloadStr = JSON.stringify({
      enc: true,
      salt,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      timestamp: new Date().toISOString()
    }, null, 2);
  } else {
    // Standard backup logic for backward compatibility/unencrypted choice
    finalPayloadStr = JSON.stringify(patients, null, 2);
  }

  // 3. Create file metadata shell on Google Drive with parent folder ID constraint
  const metaResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: fileName,
      mimeType: 'application/json',
      description: 'Concord Clinical Safe Ledger Database backup.',
      parents: folderId ? [folderId] : undefined
    }),
  });

  if (!metaResponse.ok) {
    const err = await metaResponse.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to provision Drive file: ${metaResponse.statusText}`);
  }

  const metaData = await metaResponse.json();
  const fileId = metaData.id;

  // 4. Upload the encrypted or plain payload
  const uploadResponse = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: finalPayloadStr,
    }
  );

  if (!uploadResponse.ok) {
    const err = await uploadResponse.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to upload database payload to Drive: ${uploadResponse.statusText}`);
  }

  return {
    id: fileId,
    name: fileName,
  };
}

/**
 * Lists clinical JSON database backup files available in the user's Google Drive directory.
 */
export async function listBackupsInDrive(accessToken: string): Promise<DriveFileMetadata[]> {
  const folderId = await getOrCreatePrivateFolder(accessToken);
  
  // Search for backups under the private folder if it exists, otherwise general name-containing search
  let query = "mimeType = 'application/json' and trashed = false and name contains 'Clinical Ledger Backup'";
  if (folderId) {
    query = `'${folderId}' in parents and mimeType = 'application/json' and trashed = false`;
  }
  
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime,size,webViewLink)&orderBy=createdTime desc&pageSize=30`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch backups list: ${response.statusText}`);
  }

  const data = await response.json();
  const files = data.files || [];
  return files.map((f: any) => ({
    id: f.id,
    name: f.name,
    createdTime: f.createdTime,
    webViewLink: f.webViewLink,
    size: f.size ? parseInt(f.size, 10) : undefined
  }));
}

/**
 * Restores the clinical database by fetching, decrypting if necessary, and parsing a specific JSON backup from Google Drive.
 */
export async function restoreDatabaseFromDrive(
  accessToken: string,
  fileId: string,
  passphrase?: string
): Promise<Patient[]> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Failed to download clinical backup payload: ${response.statusText}. ${err}`);
  }

  const payload = await response.json();

  // If payload is a standard patient array, it wasn't encrypted
  if (Array.isArray(payload)) {
    return payload;
  }

  // Encrypted backup payload mapping
  if (payload && payload.enc && payload.ciphertext && payload.iv && payload.salt) {
    if (!passphrase || !passphrase.trim()) {
      throw new Error('This private backup is encrypted. Please enter the correct passphrase to decrypt and restore.');
    }

    try {
      const derived = await deriveKey(passphrase.trim(), payload.salt);
      const decryptedText = await decrypt(payload.ciphertext, payload.iv, derived);
      const parsedPatients = JSON.parse(decryptedText);

      if (!Array.isArray(parsedPatients)) {
        throw new Error('Decrypted contents do not contain a valid patient entity list.');
      }
      return parsedPatients;
    } catch (e: any) {
      throw new Error(`Decryption Failed: Incorrect passphrase. Please verify your credentials. (${e.message || e})`);
    }
  }

  throw new Error('Retrieved payload is corrupt or not formatted in valid clinical patient schemas.');
}

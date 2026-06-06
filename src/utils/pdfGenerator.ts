import { jsPDF } from 'jspdf';
import { Patient } from '../types/patient';
import { FormSettings, ThemeOption } from '../types/settings';

const getThemeColor = (themeId: string) => {
  switch (themeId) {
    case 'blue': return { main: '#1e40af', light: '#eff6ff', border: '#bfdbfe' }; // blue-800
    case 'teal': return { main: '#115e59', light: '#f0fdfa', border: '#99f6e4' }; // teal-800
    case 'indigo': return { main: '#3730a3', light: '#eef2ff', border: '#c7d2fe' }; // indigo-800
    case 'rose': return { main: '#9f1239', light: '#fff1f2', border: '#fecdd3' }; // rose-800
    case 'emerald': return { main: '#065f46', light: '#ecfdf5', border: '#a7f3d0' }; // emerald-800
    case 'slate': return { main: '#334155', light: '#f8fafc', border: '#cbd5e1' }; // slate-700
    default: return { main: '#1e40af', light: '#eff6ff', border: '#bfdbfe' };
  }
};

const formatToDDMMYYYY = (dateStr: string): string => {
  if (!dateStr) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export const generatePatientPDF = (
  patient: Patient, 
  anonymized: boolean, 
  settings: FormSettings,
  activeTheme: ThemeOption
): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const themeId = settings.theme;
  const colors = getThemeColor(themeId);
  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - (margin * 2);

  // Helper to draw clean section headers
  const drawSectionHeader = (title: string, yPos: number) => {
    // Left vertical colored indicator bar
    doc.setFillColor(colors.main);
    doc.rect(margin, yPos, 3, 6, 'F');
    // Header text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(colors.main);
    doc.text(title.toUpperCase(), margin + 5, yPos + 4.8);
    // Underline rule line
    doc.setDrawColor('#e2e8f0');
    doc.setLineWidth(0.3);
    doc.line(margin, yPos + 8, margin + contentW, yPos + 8);
  };

  const drawHeaderLogo = (yPos: number, pageNum: number, titleText: string) => {
    // Clean Header Bar
    doc.setFillColor(colors.light);
    doc.rect(margin, yPos, contentW, 20, 'F');
    
    doc.setDrawColor(colors.border);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPos, contentW, 20, 'S');

    let textOffsetX = 6;
    const showLogo = settings.pdfHeaderLogo !== false;
    if (showLogo && settings.companyLogo) {
      try {
        let format = 'PNG';
        if (settings.companyLogo.includes('image/jpeg') || settings.companyLogo.includes('image/jpg')) {
          format = 'JPEG';
        } else if (settings.companyLogo.includes('image/webp')) {
          format = 'WEBP';
        }
        doc.addImage(settings.companyLogo, format, margin + 4, yPos + 3, 26, 14);
        textOffsetX = 34; // Shift clinical title to make space for organization logo
      } catch (e) {
        console.warn('EHR Custom PDF Logo render failed', e);
        try {
          doc.addImage(settings.companyLogo, margin + 4, yPos + 3, 26, 14);
          textOffsetX = 34;
        } catch (err) {
          console.error('Secondary EHR Custom PDF Logo render failed', err);
        }
      }
    }

    // Title text inside
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(colors.main);
    doc.text(titleText, margin + textOffsetX, yPos + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor('#334155');
    doc.text((settings.appName || 'ZERO-KNOWLEDGE EHR SECURED RECORD PLATFORM').toUpperCase(), margin + textOffsetX, yPos + 14);

    // Metadata Right-aligned
    if (settings.pdfHeaderDocId !== false) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor('#475569');
      doc.text(`Doc ID: ${patient.id.substring(0, 8).toUpperCase()}-${patient.code}`, margin + contentW - 6, yPos + 7, { align: 'right' });
    }
    
    if (settings.pdfHeaderConfidential !== false) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor('#ef4444');
      doc.text('CONFIDENTIAL MEDICAL RECORD', margin + contentW - 6, yPos + 12, { align: 'right' });
    }

    if (settings.pdfHeaderDate !== false) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor('#94a3b8');
      doc.text(`Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 16)} UTC`, margin + contentW - 6, yPos + 16, { align: 'right' });
    }
  };

  const drawFooter = (currentY: number, pageNum: number, totalPages: number) => {
    doc.setDrawColor('#e2e8f0');
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, margin + contentW, currentY);

    // Signature Area
    if (settings.pdfFooterSignature === true) {
      doc.setFont('helvetica', 'semibold');
      doc.setFontSize(7.5);
      doc.setTextColor('#475569');
      doc.text(`Authorized Seal & Signature: _______________________`, margin, currentY - 4);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor('#64748b');

    // Bottom details block
    let leftText = '';
    const showWatermark = settings.pdfFooterWatermark !== false;
    if (showWatermark) {
      leftText = `Secure Cryptographic Ledger - ${settings.appName || 'Concord Stem Cell MSC Record'}. Information encrypted 100% client-side.`;
    }
    
    const showAddress = settings.pdfFooterAddress !== false;
    if (showAddress && (settings.companyAddress || settings.companyInfo)) {
      const parts = [];
      if (settings.companyAddress) parts.push(settings.companyAddress.trim());
      if (settings.companyInfo) parts.push(settings.companyInfo.trim());
      leftText = `${parts.join('  •  ')}`;
      
      doc.setFont('helvetica', 'semibold');
      doc.setFontSize(7.5);
      doc.setTextColor('#475569');
      const splitLeft = doc.splitTextToSize(leftText, contentW - 25);
      doc.text(splitLeft, margin, currentY + 4.5);

      if (showWatermark) {
        // Add a fine-print secure line just below it
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor('#94a3b8');
        doc.text(`Secure Cryptographic Ledger - ${settings.appName || 'Concord Stem Cell MSC Record'}. Certified 100% clinician sealed records.`, margin, currentY + 11.5);
      }
    } else if (leftText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor('#64748b');
      const splitLeft = doc.splitTextToSize(leftText, contentW - 25);
      doc.text(splitLeft, margin, currentY + 4.5);
    }

    if (settings.pdfFooterPageNumber !== false) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor('#94a3b8');
      doc.text(`Page ${pageNum} of ${totalPages}`, margin + contentW, currentY + 4.5, { align: 'right' });
    }
  };

  // --- DYNAMIC SECTION LAYOUT ENGINE ---
  
  // Custom headlines mapping
  const headlineAdmission = settings.headlineAdmission || 'Patient Admission Record';
  const headlineDemographics = settings.headlineDemographics || '1. Core Patient Demographics';
  const headlineParameters = settings.headlineParameters || '2. Clinical Parameters & Protocols';
  const headlineRemarks = settings.headlineRemarks || '3. Admitting Practitioner Remarks';
  const headlineFollowUpTitle = settings.headlineFollowUpTitle || '4. Follow-Up Assessment Timeline';
  const headlineSessionsTitle = settings.headlineSessionsTitle || '5. Treatment Sessions Ledger';

  const printSectionsOrder = settings.printSectionsOrder || ['demographics', 'parameters', 'remarks', 'followups', 'sessions'];
  const printSectionsIncluded = settings.printSectionsIncluded || ['demographics', 'parameters', 'remarks', 'followups', 'sessions'];
  const finalSectionsToPrint = printSectionsOrder.filter(secId => printSectionsIncluded.includes(secId));

  const labelPatientCode = settings.labelPatientCode || 'Patient Code/ID';
  const labelPatientName = settings.labelPatientName || 'Patient Full Name';
  const labelAge = settings.labelAge || 'Patient Age';
  const labelSex = settings.labelSex || 'Biological Sex';
  const labelPhone = settings.labelPhone || 'Contact Telephone';
  const labelDiagnosis = settings.labelDiagnosis || 'Admitting Diagnosis';
  const labelConsultant = settings.labelConsultant || 'Attending Consultant';
  const labelTreatment = settings.labelTreatment || 'Active Treatment Protocol';
  const labelRoute = settings.labelRoute || 'Product Route';
  const labelProcedurePlace = settings.labelProcedurePlace || 'Procedure Place';
  const labelAmount = settings.labelAmount || 'Product Dosage';
  const labelNotes = settings.labelNotes || 'Practitioner Notes';

  // 1. Draw Title Block
  const titleText = anonymized 
    ? `${headlineAdmission.toUpperCase()} (ANONYMISED)` 
    : `${headlineAdmission.toUpperCase()} & PROFILE SUMMARY`;

  drawHeaderLogo(15, 1, titleText);

  let curY = 42;

  // Helpmates to render Page 1 sections
  const drawDemographics = (y: number): number => {
    drawSectionHeader(headlineDemographics, y);
    y += 12;

    // Let's split column locations dynamically if patient's photo is present!
    const hasPic = !!patient.profilePic;
    let demoX1 = margin + 5;
    let demoX2 = margin + (contentW / 3) + 2;
    let demoX3 = margin + (contentW * 2 / 3) + 2;

    if (hasPic) {
      try {
        doc.setFillColor('#cbd5e1');
        doc.setDrawColor('#e2e8f0');
        doc.rect(margin, y - 2, 20, 20, 'S');
        doc.addImage(patient.profilePic!, 'JPEG', margin + 0.5, y - 1.5, 19, 19);
        
        // Shift columns to fit photo nicely
        demoX1 = margin + 24;
        demoX2 = margin + (contentW / 3) + 14;
        demoX3 = margin + (contentW * 2 / 3) + 8;
      } catch (e) {
        console.warn('PDF Patient photo drawing failed', e);
        demoX1 = margin + 5;
        demoX2 = margin + (contentW / 3) + 2;
        demoX3 = margin + (contentW * 2 / 3) + 2;
      }
    }

    const displayName = anonymized 
      ? (patient.name.split(' ').map(n => n[0]).join('.') || 'N/A') + '*****' 
      : patient.name;
    
    const displayPhone = anonymized ? 'REDACTED (CONCEALED FOR PRIVACY)' : patient.phone;

    // Col 1
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor('#94a3b8');
    doc.text(labelPatientName.toUpperCase(), demoX1, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor('#1e293b');
    doc.text(displayName, demoX1, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor('#94a3b8');
    doc.text(labelSex.toUpperCase(), demoX1, y + 11.5);
    doc.setFont('helvetica', 'semibold');
    doc.setFontSize(8.5);
    doc.setTextColor('#1e293b');
    doc.text(patient.sex, demoX1, y + 16);

    // Col 2
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor('#94a3b8');
    doc.text(labelPatientCode.toUpperCase(), demoX2, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colors.main);
    doc.text(patient.code, demoX2, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor('#94a3b8');
    doc.text(labelAge.toUpperCase(), demoX2, y + 11.5);
    doc.setFont('helvetica', 'semibold');
    doc.setFontSize(8.5);
    doc.setTextColor('#1e293b');
    doc.text(`${patient.age} years old`, demoX2, y + 16);

    // Col 3
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor('#94a3b8');
    doc.text(labelPhone.toUpperCase(), demoX3, y);
    doc.setFont('helvetica', 'semibold');
    doc.setFontSize(8);
    doc.setTextColor('#1e293b');
    doc.text(displayPhone, demoX3, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor('#94a3b8');
    doc.text('TREATMENT DATE', demoX3, y + 11.5);
    doc.setFont('helvetica', 'semibold');
    doc.setFontSize(8.5);
    doc.setTextColor('#475569');
    doc.text(formatToDDMMYYYY(patient.date), demoX3, y + 16);

    return y + 24;
  };

  const drawParameters = (y: number): number => {
    drawSectionHeader(headlineParameters, y);
    
    y += 12;
    const clinX1 = margin + 5;
    const clinX2 = margin + (contentW / 2) + 2;

    // Row 1: Diagnosis & Attending MD
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor('#64748b');
    doc.text(labelDiagnosis.toUpperCase(), clinX1, y);
    doc.text(labelConsultant.toUpperCase(), clinX2, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor('#0f172a');
    
    const diagSplit = doc.splitTextToSize(patient.diagnosis, (contentW / 2) - 10);
    doc.text(diagSplit, clinX1, y + 4);
    
    const consultantSplit = doc.splitTextToSize(patient.consultant, (contentW / 2) - 10);
    doc.text(consultantSplit, clinX2, y + 4);

    const diagH = diagSplit.length * 4.5;
    const consH = consultantSplit.length * 4.5;
    const offset1 = Math.max(diagH, consH, 10);

    // Row 2: Treatment & Route
    const curYRow2 = y + offset1 + 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor('#64748b');
    doc.text(labelTreatment.toUpperCase(), clinX1, curYRow2);
    doc.text(`${labelAmount.toUpperCase()} & ${labelRoute.toUpperCase()}`, clinX2, curYRow2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor('#0f172a');

    const treatmentSplit = doc.splitTextToSize(patient.treatment, (contentW / 2) - 10);
    doc.text(treatmentSplit, clinX1, curYRow2 + 4);

    const dosageAndRoute = `${patient.amount} via ${patient.route}${patient.procedurePlace ? ` (@ ${patient.procedurePlace})` : ''}`;
    const routeSplit = doc.splitTextToSize(dosageAndRoute, (contentW / 2) - 10);
    doc.text(routeSplit, clinX2, curYRow2 + 4);

    const treatH = treatmentSplit.length * 4.5;
    const routeH = routeSplit.length * 4.5;
    const offset2 = Math.max(treatH, routeH, 10);

    // Row 3: Session & Clinical Progress Status
    const curYRow3 = curYRow2 + offset2 + 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor('#64748b');
    doc.text('SESSION', clinX1, curYRow3);
    doc.text('CLINICAL PROGRESS STATUS', clinX2, curYRow3);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colors.main);
    const totalSessionsCount = patient.treatmentSessions?.length || 0;
    doc.text(`Total: ${totalSessionsCount}`, clinX1, curYRow3 + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(patient.improvement.toUpperCase(), clinX2, curYRow3 + 4.5);

    return curYRow3 + 14;
  };

  const drawRemarks = (y: number): number => {
    drawSectionHeader(headlineRemarks, y);

    y += 12;
    doc.setFillColor('#fafafa');
    doc.setDrawColor('#e2e8f0');
    doc.setLineWidth(0.3);
    
    const notesText = patient.notes || 'No extensive diagnostic remarks logged for this intake ledger item.';
    const notesSplit = doc.splitTextToSize(notesText, contentW - 10);
    const notesBoxH = Math.max((notesSplit.length * 4.2) + 8, 20);

    doc.rect(margin, y, contentW, notesBoxH, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#334155');
    doc.text(notesSplit, margin + 5, y + 6);

    return y + notesBoxH + 14;
  };

  // Check how many pages we need based on follow-ups and treatment sessions
  const hasFollowUps = patient.followUps && patient.followUps.length > 0;
  const hasSessions = patient.treatmentSessions && patient.treatmentSessions.length > 0;

  // Render sections sequentially based on selected print sections list
  finalSectionsToPrint.forEach((secId) => {
    if (secId === 'demographics') {
      curY = drawDemographics(curY);
    } else if (secId === 'parameters') {
      curY = drawParameters(curY);
    } else if (secId === 'remarks') {
      curY = drawRemarks(curY);
    } else if (secId === 'followups') {
      // --- PAGE 2: TIMELINE FOLLOW-UPS (If Exist) ---
      if (hasFollowUps) {
        doc.addPage();
        // Header Logo for the first page of timeline
        drawHeaderLogo(15, (doc.internal as any).getNumberOfPages(), headlineFollowUpTitle.toUpperCase());

        let currentY = 42;
        drawSectionHeader(headlineFollowUpTitle, currentY);
        currentY += 12;

        const itemsToRender = patient.followUps.slice().reverse();

        itemsToRender.forEach((f, idx) => {
          const cardH = 34;

          // If card overflows page budget, start a fresh page
          if (currentY + cardH > 265) {
            doc.addPage();
            drawHeaderLogo(15, (doc.internal as any).getNumberOfPages(), headlineFollowUpTitle.toUpperCase());
            currentY = 42;
            drawSectionHeader(`${headlineFollowUpTitle} (CONTINUED)`, currentY);
            currentY += 12;
          }

          const itemY = currentY;
          currentY += cardH + 4; // Advance Y coordinate for following records

          doc.setFillColor('#fafbfd'); 
          doc.setDrawColor('#f1f5f9');
          doc.setLineWidth(0.3);
          doc.rect(margin, itemY, contentW, cardH, 'FD');

          doc.setFillColor(colors.main);
          doc.rect(margin, itemY, 2, cardH, 'F');

          // Col 1: Date & Status
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(colors.main);
          doc.text(`CONSULTATION: ${formatToDDMMYYYY(f.date)}`, margin + 5, itemY + 5);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor('#475569');
          const statLabelSplit = doc.splitTextToSize(`Status: ${f.status || 'Stable'}`, (contentW / 2) - 10);
          doc.text(statLabelSplit, margin + 5, itemY + 10);

          // Col 2: Clinician
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor('#1e293b');
          doc.text(`Clinician: Dr. ${f.clinician}`, margin + (contentW / 2) + 5, itemY + 5);

          // Split assessment notes
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor('#334155');
          
          const clinicalNotesText = f.notes || 'No assessment summary notes registered.';
          const notesLines = doc.splitTextToSize(clinicalNotesText, contentW - 12);
          const truncatedNotesLines = notesLines.slice(0, 3);
          doc.text(truncatedNotesLines, margin + 5, itemY + 18);

          if (f.attachments && f.attachments.length > 0) {
            doc.setFont('helvetica', 'bolditalic');
            doc.setFontSize(6.5);
            doc.setTextColor('#3b82f6');
            const countText = `Attached Files: ${f.attachments.map(a => a.name).join(', ')}`;
            doc.text(countText, margin + 5, itemY + cardH - 2);
          }
        });
      }
    } else if (secId === 'sessions') {
      // --- PAGE 3: TREATMENT SESSIONS LEDGER (If Exist) ---
      if (hasSessions) {
        doc.addPage();
        drawHeaderLogo(15, (doc.internal as any).getNumberOfPages(), headlineSessionsTitle.toUpperCase());

        let currentY = 42;
        drawSectionHeader(headlineSessionsTitle, currentY);
        currentY += 12;

        const sessionsToRender = (patient.treatmentSessions || []).slice().reverse();

        sessionsToRender.forEach((s, idx) => {
          const cardH = 28;

          // If card overflows page budget, start a fresh page
          if (currentY + cardH > 265) {
            doc.addPage();
            drawHeaderLogo(15, (doc.internal as any).getNumberOfPages(), headlineSessionsTitle.toUpperCase());
            currentY = 42;
            drawSectionHeader(`${headlineSessionsTitle} (Continued)`, currentY);
            currentY += 12;
          }

          const itemY = currentY;
          currentY += cardH + 4;

          doc.setFillColor('#fafdfb'); 
          doc.setDrawColor('#ecfdf5');
          doc.setLineWidth(0.3);
          doc.rect(margin, itemY, contentW, cardH, 'FD');

          doc.setFillColor('#10b981'); // Emerald colored bar
          doc.rect(margin, itemY, 2, cardH, 'F');

          // Col 1: Session # & Date
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.2);
          doc.setTextColor('#047857'); // Emerald-700
          doc.text(`SESSION #${s.sessionNo} - ${formatToDDMMYYYY(s.date)}`, margin + 5, itemY + 5);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor('#475569');
          doc.text(`Practitioner: ${s.consultant}`, margin + 5, itemY + 10);

          // Col 2: Protocol, Dose & Route
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor('#1e293b');
          doc.text(`Protocol: ${s.treatment}`, margin + (contentW / 2) + 5, itemY + 5);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor('#475569');
          doc.text(`Dose & Route: ${s.amount} (${s.route})`, margin + (contentW / 2) + 5, itemY + 10);

          // Notes
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor('#334155');
          
          const sessionNotesText = s.notes || 'No extensive session remarks documented.';
          const notesLines = doc.splitTextToSize(sessionNotesText, contentW - 12);
          const truncatedNotesLines = notesLines.slice(0, 2);
          doc.text(truncatedNotesLines, margin + 5, itemY + 17);
        });
      }
    }
  });

  // --- DRAW FOOTERS ON ALL PAGES ---
  const totalPagesCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPagesCount; i++) {
    doc.setPage(i);
    drawFooter(276, i, totalPagesCount);
  }

  return doc;
};

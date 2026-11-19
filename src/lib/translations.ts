import type { Locale } from "./types";

const messages: Record<Locale, Record<string, string>> = {
  en: {
    newReport: "New health report", animal: "Select animal", symptoms: "Observed symptoms", onset: "Symptom onset date", severity: "Reported severity", mortality: "Has mortality been reported?", location: "Approximate area / village", notes: "Additional observation", photo: "Photo evidence", voice: "Voice input", gps: "Use device location", continue: "Continue", review: "Review & submit", submit: "Submit report", stepAnimal: "Animal & symptoms", stepSeverity: "Severity & location", farmer: "Farmer", veterinarian: "Veterinarian", offlineQueued: "Saved offline — will sync when you're back online."
  },
  mr: {
    newReport: "नवीन आरोग्य अहवाल", animal: "प्राणी निवडा", symptoms: "आढळलेली लक्षणे", onset: "लक्षणे सुरू झाल्याची तारीख", severity: "नोंदवलेली तीव्रता", mortality: "मृत्यूची नोंद आहे का?", location: "अंदाजे परिसर / गाव", notes: "अतिरिक्त निरीक्षण", photo: "फोटो पुरावा", voice: "आवाजातून मजकूर", gps: "डिव्हाइसचे स्थान वापरा", continue: "पुढे जा", review: "तपासा आणि पाठवा", submit: "अहवाल पाठवा", stepAnimal: "प्राणी आणि लक्षणे", stepSeverity: "तीव्रता आणि स्थान", farmer: "शेतकरी", veterinarian: "पशुवैद्य", offlineQueued: "ऑफलाइन जतन केले — इंटरनेट आल्यावर समक्रमित होईल."
  },
  hi: {
    newReport: "नई स्वास्थ्य रिपोर्ट", animal: "पशु चुनें", symptoms: "दिखे हुए लक्षण", onset: "लक्षण शुरू होने की तारीख", severity: "बताई गई गंभीरता", mortality: "क्या मृत्यु की सूचना है?", location: "अनुमानित क्षेत्र / गांव", notes: "अतिरिक्त जानकारी", photo: "फोटो प्रमाण", voice: "आवाज़ से लिखें", gps: "डिवाइस का स्थान उपयोग करें", continue: "जारी रखें", review: "जांचें और जमा करें", submit: "रिपोर्ट जमा करें", stepAnimal: "पशु और लक्षण", stepSeverity: "गंभीरता और स्थान", farmer: "किसान", veterinarian: "पशु चिकित्सक", offlineQueued: "ऑफ़लाइन सहेजा गया — इंटरनेट आने पर सिंक होगा।"
  }
};
export const translate = (locale: Locale, key: string) => messages[locale][key] ?? messages.en[key] ?? key;
export const localeName: Record<Locale, string> = { en: "English", mr: "मराठी", hi: "हिन्दी" };

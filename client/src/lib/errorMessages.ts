/**
 * Parse tRPC/Zod error messages and return user-friendly German messages
 */

interface ZodError {
  code: string;
  path: string[];
  message: string;
  format?: string;
}

/**
 * Field name translations (German)
 */
const FIELD_NAMES: Record<string, string> = {
  email: "E-Mail-Adresse",
  name: "Name",
  title: "Titel",
  description: "Beschreibung",
  eventDate: "Datum",
  location: "Ort",
  firstName: "Vorname",
  lastName: "Nachname",
  street: "Strasse",
  houseNumber: "Hausnummer",
  zipCode: "PLZ",
  city: "Stadt",
  phone: "Telefonnummer",
  websiteUrl: "Website-URL",
  password: "Passwort",
  message: "Nachricht",
  subject: "Betreff",
  role: "Rolle",
  bio: "Biografie",
  nickname: "Spitzname",
  notes: "Notizen",
};

/**
 * Get user-friendly field name
 */
function getFieldName(path: string[]): string {
  const field = path[path.length - 1];
  return FIELD_NAMES[field] || field;
}

/**
 * Parse Zod validation errors
 */
function parseZodError(zodError: ZodError): string {
  const fieldName = getFieldName(zodError.path);
  
  switch (zodError.code) {
    case "invalid_type":
      return `${fieldName} ist erforderlich`;
    
    case "too_small":
      return `${fieldName} ist zu kurz`;
    
    case "too_big":
      return `${fieldName} ist zu lang`;
    
    case "invalid_string":
    case "invalid_format":
      if (zodError.format === "email") {
        return `Bitte gib eine gültige E-Mail-Adresse ein`;
      }
      if (zodError.format === "url") {
        return `Bitte gib eine gültige URL ein (z.B. https://example.com)`;
      }
      return `${fieldName} hat ein ungültiges Format`;
    
    case "invalid_enum_value":
      return `${fieldName} hat einen ungültigen Wert`;
    
    case "invalid_date":
      return `Bitte gib ein gültiges Datum ein`;
    
    default:
      return `${fieldName}: ${zodError.message}`;
  }
}

/**
 * Parse tRPC error message and return user-friendly message
 */
export function parseErrorMessage(error: any): string {
  // Handle string errors
  if (typeof error === "string") {
    return error;
  }

  // Handle error objects with message
  if (error?.message) {
    const message = error.message;

    // Try to parse as JSON (Zod validation errors)
    try {
      const parsed = JSON.parse(message);
      
      // Handle array of Zod errors
      if (Array.isArray(parsed)) {
        const zodErrors = parsed as ZodError[];
        if (zodErrors.length > 0) {
          // Return first error (most relevant)
          return parseZodError(zodErrors[0]);
        }
      }
      
      // Handle single Zod error
      if (parsed.code && parsed.path) {
        return parseZodError(parsed as ZodError);
      }
    } catch {
      // Not JSON, use message as-is
    }

    // Handle common tRPC error codes
    if (message.includes("UNAUTHORIZED")) {
      return "Du musst angemeldet sein, um diese Aktion auszuführen";
    }
    
    if (message.includes("FORBIDDEN")) {
      return "Du hast keine Berechtigung für diese Aktion";
    }
    
    if (message.includes("NOT_FOUND")) {
      return "Der angeforderte Eintrag wurde nicht gefunden";
    }
    
    if (message.includes("CONFLICT")) {
      return "Ein Eintrag mit diesen Daten existiert bereits";
    }
    
    if (message.includes("TOO_MANY_REQUESTS")) {
      return "Zu viele Anfragen. Bitte versuche es später erneut";
    }

    // Handle file upload errors
    if (message.includes("File too large")) {
      return "Die Datei ist zu gross (max. 25MB)";
    }
    
    if (message.includes("Invalid file type")) {
      return "Ungültiger Dateityp. Bitte lade ein Bild hoch";
    }

    // Handle database errors
    if (message.includes("Duplicate entry")) {
      return "Ein Eintrag mit diesen Daten existiert bereits";
    }

    // Return original message if no specific handling
    return message;
  }

  // Fallback
  return "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut";
}

/**
 * Show user-friendly error toast
 */
export function showErrorToast(error: any, toast: any) {
  const message = parseErrorMessage(error);
  toast.error(message);
}

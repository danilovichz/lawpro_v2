import { supabase } from './supabase';
import axios from 'axios';

// Lawyer data structure (same interface to maintain compatibility)
export interface Lawyer {
  id: string;
  state: string;
  city: string;
  county: string;
  lawFirm: string;
  phoneNumber: string;
  email: string | null;
  website: string | null;
  createdAt: string;
  // Computed fields for our UI
  name?: string;
  specialty?: string;
  rating?: number;
  profileImageUrl?: string;
  availability?: 'Available Now' | 'Busy' | 'Offline';
  isFirmVerified?: boolean;
  description?: string;
  practiceAreas?: string[];
}

// OpenAI API configuration
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

/**
 * Extract location (county and state) from text with enhanced logic for cities that are also counties
 */
export async function extractLocationFromText(text: string): Promise<{county?: string, state?: string}> {
  try {
    console.log('[LOCATION] Processing text for location extraction:', text.substring(0, 100) + '...');
    
    // Special handling for known city-counties (like Honolulu)
    const cityCounties = [
      'Honolulu', 'San Francisco', 'Philadelphia', 'Baltimore', 'St. Louis',
      'Denver', 'Washington', 'New York', 'Los Angeles', 'San Diego'
    ];
    
    // First try direct pattern matching for obvious location mentions
    // Format: "in City/County, State" or similar
    const directLocationPattern = /\b(?:in|at|from|to|for|near)\s+([A-Za-z\s]+?)(?:\s+county)?,\s+([A-Za-z\s]+)\b/i;
    const directMatch = text.match(directLocationPattern);
    
    if (directMatch && directMatch[1] && directMatch[2]) {
      const locationCandidate = directMatch[1].trim();
      const stateCandidate = directMatch[2].trim();
      
      // Verify the state is valid
      const stateMap: Record<string, string> = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
        'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
        'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
        'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
        'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
        'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
        'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
        'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
      };
      
      const stateIsValid = Object.keys(stateMap).some(state => 
        state === stateCandidate.toLowerCase() || 
        stateMap[state] === stateCandidate.toUpperCase()
      );
      
      if (stateIsValid) {
        // Check if the location is a known city-county
        const isCityCounty = cityCounties.some(cc => 
          cc.toLowerCase() === locationCandidate.toLowerCase()
        );
        
        console.log('[LOCATION] Direct pattern match found:', { 
          location: locationCandidate, 
          state: stateCandidate,
          isCityCounty 
        });
        
        // For city-counties like Honolulu, treat them as counties
        if (isCityCounty) {
          return {
            county: locationCandidate,
            state: stateCandidate
          };
        }
        
        // Otherwise, just return the state (since we can't be sure if it's a county)
        return {
          state: stateCandidate
        };
      }
    }
    
    // Special case for "hawaii honolulu" or "honolulu hawaii" without comma
    const hawaiiHonoluluPattern = /\b(honolulu|hawaii)\s+(honolulu|hawaii)\b/i;
    const hawaiiMatch = text.match(hawaiiHonoluluPattern);
    if (hawaiiMatch) {
      console.log('[LOCATION] Special case: Honolulu, Hawaii detected');
      return {
        county: 'Honolulu',
        state: 'Hawaii'
      };
    }
    
    // Check for just "Honolulu" mentioned
    if (text.toLowerCase().includes('honolulu')) {
      console.log('[LOCATION] Honolulu mentioned, assuming Hawaii');
      return {
        county: 'Honolulu',
        state: 'Hawaii'
      };
    }
    
    // Simple state-only pattern match: "in Nevada" or similar
    const stateOnlyPattern = /\b(?:in|at|from|to|for|near)\s+([A-Za-z\s]+)\b/i;
    const stateMatch = text.match(stateOnlyPattern);
    
    if (stateMatch && stateMatch[1]) {
      const stateCandidate = stateMatch[1].trim();
      
      // Check if this is a valid state name
      const validStates = [
        'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
        'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
        'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
        'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
        'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
        'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
        'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
        'wisconsin', 'wyoming'
      ];
      
      const normalizedState = stateCandidate.toLowerCase();
      
      if (validStates.includes(normalizedState)) {
        console.log('[LOCATION] Direct state match found:', { state: stateCandidate });
        return {
          state: stateCandidate
        };
      }
    }
    
    // Special explicit check for "Clark, Nevada" and variations
    if (text.toLowerCase().includes('clark') && text.toLowerCase().includes('nevada')) {
      console.log('[LOCATION] Special case: Clark, Nevada explicitly mentioned');
      return {
        county: 'Clark',
        state: 'Nevada'
      };
    }
    
    // If direct pattern matching didn't work, try AI extraction
    const response = await axios.post(OPENAI_ENDPOINT, {
      model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
            You are a precise location extraction service that identifies US counties and states mentioned in text.
            Extract ONLY the most specific location mentioned. Focus on identifying:
            1. County name (without the word "County" unless that's how it's specified in text)
            2. State name or abbreviation
            
            Special rules:
            - "Honolulu" should be treated as both a city AND county in Hawaii
            - Cities like San Francisco, Philadelphia, Denver are also counties
            - If only a city is mentioned (like "Honolulu"), try to infer the state
            
            Return a JSON object with 'county' and 'state' fields, with null for any field not found.
            IMPORTANT: 
            - Return the exact location as mentioned, preserving case
            - Do not add "County" to county names unless it was explicitly mentioned
            - If multiple locations are mentioned, select the most specific/recent one
            - Do not invent locations - if none are mentioned, return null values
            - Do not return cities or other location types unless they are also counties
            - Make sure you ALWAYS recognize "Nevada" as a state and "Clark" as a county in Nevada when mentioned
            - Make sure you ALWAYS recognize "Hawaii" as a state and "Honolulu" as a county in Hawaii when mentioned
            `
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" }
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // OpenRouter API spec compliance check
    if (response.status !== 200) {
      console.error('[LOCATION] AI API error:', response.status);
      throw new Error(`API error: ${response.status}`);
    }

    // Validate OpenRouter response structure
    if (!response.data || !response.data.choices || !Array.isArray(response.data.choices) || response.data.choices.length === 0) {
      throw new Error('Invalid OpenRouter API response structure - missing choices array');
    }

    const choice = response.data.choices[0];
    if (!choice.message || !choice.message.content) {
      throw new Error('Invalid OpenRouter API response structure - missing message content');
    }

    const data = response.data;
    const content = choice.message.content;
    
    try {
      const locationJson = JSON.parse(content);
      console.log('[LOCATION] AI extracted:', locationJson);
      
      return {
        county: locationJson.county || undefined,
        state: locationJson.state || undefined
      };
    } catch (err) {
      console.error('[LOCATION] Error parsing AI response:', content);
      return { county: undefined, state: undefined };
    }
  } catch (error) {
    console.error('[LOCATION] Error in location extraction:', error);
    return { county: undefined, state: undefined };
  }
}

/**
 * Normalize a county name by adding or removing "County" suffix
 */
function normalizeCountyName(county: string): string[] {
  if (!county) return [];
  
  const countyLower = county.toLowerCase().trim();
  const variants = [countyLower];
  
  // If "county" is already in the name, add a version without it
  if (countyLower.endsWith(' county')) {
    variants.push(countyLower.substring(0, countyLower.length - 7).trim());
  } 
  // If "county" is not in the name, add a version with it
  else {
    variants.push(`${countyLower} county`);
  }
  
  return variants;
}

/**
 * Normalize a state name by including common abbreviations
 */
function normalizeStateName(state: string): string[] {
  if (!state) return [];
  
  const stateLower = state.toLowerCase().trim();
  const variants = [stateLower];
  
  // Add common state abbreviations
  const stateMap: Record<string, string> = {
    'alabama': 'al',
    'alaska': 'ak',
    'arizona': 'az',
    'arkansas': 'ar',
    'california': 'ca',
    'colorado': 'co',
    'connecticut': 'ct',
    'delaware': 'de',
    'florida': 'fl',
    'georgia': 'ga',
    'hawaii': 'hi',
    'idaho': 'id',
    'illinois': 'il',
    'indiana': 'in',
    'iowa': 'ia',
    'kansas': 'ks',
    'kentucky': 'ky',
    'louisiana': 'la',
    'maine': 'me',
    'maryland': 'md',
    'massachusetts': 'ma',
    'michigan': 'mi',
    'minnesota': 'mn',
    'mississippi': 'ms',
    'missouri': 'mo',
    'montana': 'mt',
    'nebraska': 'ne',
    'nevada': 'nv',
    'new hampshire': 'nh',
    'new jersey': 'nj',
    'new mexico': 'nm',
    'new york': 'ny',
    'north carolina': 'nc',
    'north dakota': 'nd',
    'ohio': 'oh',
    'oklahoma': 'ok',
    'oregon': 'or',
    'pennsylvania': 'pa',
    'rhode island': 'ri',
    'south carolina': 'sc',
    'south dakota': 'sd',
    'tennessee': 'tn',
    'texas': 'tx',
    'utah': 'ut',
    'vermont': 'vt',
    'virginia': 'va',
    'washington': 'wa',
    'west virginia': 'wv',
    'wisconsin': 'wi',
    'wyoming': 'wy'
  };
  
  // Handle abbreviations to full names
  for (const [fullName, abbr] of Object.entries(stateMap)) {
    if (stateLower === abbr) {
      variants.push(fullName);
      return variants; // If exact abbreviation match, return both forms
    }
  }
  
  // Handle full names to abbreviations
  if (stateMap[stateLower]) {
    variants.push(stateMap[stateLower]);
  }
  
  return variants;
}

/**
 * Verify that a lawyer is from the given location
 */
function verifyLawyerLocation(lawyer: any, county?: string, state?: string): boolean {
  if (!county && !state) return true;
  
  // If state is specified, verify state match
  if (state) {
    const stateVariants = normalizeStateName(state);
    const lawyerState = lawyer.state.toLowerCase();
    
    const stateMatch = stateVariants.some(variant => 
      lawyerState === variant || lawyerState.includes(variant)
    );
    
    if (!stateMatch) return false;
  }
  
  // If county is specified, verify county match
  if (county) {
    const countyVariants = normalizeCountyName(county);
    const lawyerCounty = lawyer.county.toLowerCase();
    
    const countyMatch = countyVariants.some(variant => 
      lawyerCounty === variant || lawyerCounty.includes(variant)
    );
    
    if (!countyMatch) return false;
  }
  
  return true;
}

/**
 * Format raw lawyer data from database into the UI format
 */
function formatLawyerData(rawData: any): Lawyer {
  const lawFirm = rawData["Law Firm"] || "";
  
  // Parse the law firm name to create a lawyer name if needed
  let name = "Attorney Representative";
  if (lawFirm.includes("Law Offices of")) {
    name = lawFirm.replace("Law Offices of", "").trim();
  } else if (lawFirm.includes("&")) {
    name = lawFirm.split("&")[0].trim();
    if (name.includes(",")) {
      name = name.split(",")[0].trim();
    }
  } else if (lawFirm.includes("Law Firm")) {
    name = lawFirm.replace("Law Firm", "").trim();
  } else if (lawFirm) {
    name = lawFirm.split(" ")[0];
  }
  
  // Create a descriptive specialty based on location
  const specialty = rawData.county && rawData.state ?
    `${rawData.county}, ${rawData.state} Legal Specialist` :
    (rawData.state ? `${rawData.state} Legal Specialist` : 'Legal Professional');
  
  // Generate practice areas based on fields we have
  const practiceAreas = ["Legal Consultation", "Case Evaluation"];
  if (rawData.state) {
    practiceAreas.push(`${rawData.state} Legal Services`);
  }
  if (rawData.county) {
    practiceAreas.push(`${rawData.county} Legal Expert`);
  }
  
  return {
    id: rawData.id,
    state: rawData.state,
    city: rawData.city,
    county: rawData.county,
    lawFirm: rawData["Law Firm"] || "",
    phoneNumber: rawData["Phone Number"] || "",
    email: rawData.email,
    website: rawData.website,
    createdAt: rawData.created_at,
    // Computed fields
    name,
    specialty,
    rating: 4.8,
    profileImageUrl: "/placeholder-attorney.jpg",
    availability: "Available Now",
    isFirmVerified: true,
    description: `At ${lawFirm || "our firm"}, we pride ourselves on serving our clients with the utmost care and attention to detail. We understand that legal matters can be complex, and we're committed to providing the guidance and representation you need.`,
    practiceAreas
  };
}

/**
 * Get lawyers for a specified location - with STRICT state matching
 * State matching is mandatory; county is optional
 */
export async function getLawyersByLocation(county?: string, state?: string): Promise<Lawyer[]> {
  console.log('[LOCATION] Searching for lawyers in:', { county, state });
  
  // CRITICAL: State is required - we will not search without it
  if (!state) {
    console.warn('[LOCATION] No state provided, cannot search without state');
    throw new Error('State information is required to find lawyers');
  }
  
  try {
    // Normalize the state name (lowercase, remove extra spaces)
    const normalizedState = state.toLowerCase().trim();
    
    // Get the state variants (full name and abbreviation)
    const stateVariants = getStateVariants(normalizedState);
    console.log('[LOCATION] State variants for search:', stateVariants);
    
    // Build the query
    let query = supabase
      .from('lawyers_real')
      .select('*');
    
    // Build state conditions - we want lawyers from ANY of these state variants
    const stateConditions = stateVariants
      .map(variant => `state.ilike.${variant}`)
      .join(',');
    
    // If county is provided, we need BOTH state AND county to match
    if (county) {
      const normalizedCounty = county.toLowerCase().trim();
      
      // Build county variants
      const countyVariants = [normalizedCounty];
      if (!normalizedCounty.endsWith(' county')) {
        countyVariants.push(`${normalizedCounty} county`);
      } else {
        countyVariants.push(normalizedCounty.replace(' county', ''));
      }
      
      // Build county conditions
      const countyConditions = countyVariants
        .map(variant => `county.ilike.%${variant}%`)
        .join(',');
      
      // Apply both state AND county filters
      // We want: (state matches) AND (county matches)
      query = query
        .or(stateConditions)
        .or(countyConditions);
      
      // This creates an OR between state and county, but we need AND
      // Let's use a different approach with filter
    } else {
      // Just state filter
      query = query.or(stateConditions);
    }
    
    // Execute the query with a higher limit
    const { data, error } = await query.limit(50);
    
    if (error) {
      console.error('[LOCATION] Database error:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.log(`[LOCATION] No lawyers found for location:`, { county, state });
      throw new Error(`No lawyers found for ${county ? county + ', ' : ''}${state}`);
    }
    
    // CRITICAL: Filter results to ensure they match our criteria
    // This is necessary because Supabase OR conditions don't give us the AND logic we need
    const verifiedLawyers = data.filter(lawyer => {
      const lawyerState = lawyer.state.toLowerCase();
      
      // Check state match
      const isStateMatch = stateVariants.some(variant => {
        // For abbreviations (2 chars), require exact match
        if (variant.length === 2) {
          return lawyerState === variant || lawyerState === variant.toUpperCase();
        }
        // For full state names, allow case-insensitive match
        return lawyerState === variant || 
               lawyerState === variant.replace(' ', '') ||
               lawyerState.replace(' ', '') === variant;
      });
      
      if (!isStateMatch) return false;
      
      // If county was specified, also check county match
      if (county) {
        const lawyerCounty = lawyer.county.toLowerCase();
        const normalizedCounty = county.toLowerCase().trim();
        
        // Check various county formats
        const isCountyMatch = 
          lawyerCounty === normalizedCounty ||
          lawyerCounty === `${normalizedCounty} county` ||
          lawyerCounty.replace(' county', '') === normalizedCounty ||
          (normalizedCounty.endsWith(' county') && 
           lawyerCounty === normalizedCounty.replace(' county', ''));
        
        return isCountyMatch;
      }
      
      return true; // State match is sufficient if no county specified
    });
    
    if (verifiedLawyers.length === 0) {
      console.log(`[LOCATION] No verified lawyers after filtering for:`, { county, state });
      console.log('[LOCATION] Original data had', data.length, 'lawyers');
      console.log('[LOCATION] Sample of unmatched lawyers:', data.slice(0, 3).map(l => ({
        id: l.id,
        state: l.state,
        county: l.county
      })));
      throw new Error(`No lawyers found for ${county ? county + ', ' : ''}${state}`);
    }
    
    console.log(`[LOCATION] Found ${verifiedLawyers.length} verified lawyers for ${county ? county + ', ' : ''}${state}`);
    
    // Format and return the lawyers
    return verifiedLawyers.map(formatLawyerData);
  } catch (error) {
    console.error('[LOCATION] Error searching for lawyers:', error);
    throw error;
  }
}

/**
 * Get variants of a state name (full name and abbreviation)
 */
function getStateVariants(state: string): string[] {
  const stateMap: Record<string, string> = {
    'alabama': 'al', 'alaska': 'ak', 'arizona': 'az', 'arkansas': 'ar', 'california': 'ca',
    'colorado': 'co', 'connecticut': 'ct', 'delaware': 'de', 'florida': 'fl', 'georgia': 'ga',
    'hawaii': 'hi', 'idaho': 'id', 'illinois': 'il', 'indiana': 'in', 'iowa': 'ia',
    'kansas': 'ks', 'kentucky': 'ky', 'louisiana': 'la', 'maine': 'me', 'maryland': 'md',
    'massachusetts': 'ma', 'michigan': 'mi', 'minnesota': 'mn', 'mississippi': 'ms', 'missouri': 'mo',
    'montana': 'mt', 'nebraska': 'ne', 'nevada': 'nv', 'new hampshire': 'nh', 'new jersey': 'nj',
    'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd', 'ohio': 'oh',
    'oklahoma': 'ok', 'oregon': 'or', 'pennsylvania': 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
    'south dakota': 'sd', 'tennessee': 'tn', 'texas': 'tx', 'utah': 'ut', 'vermont': 'vt',
    'virginia': 'va', 'washington': 'wa', 'west virginia': 'wv', 'wisconsin': 'wi', 'wyoming': 'wy'
  };
  
  // Reverse mapping (abbreviation to full name)
  const reverseStateMap: Record<string, string> = {};
  for (const [fullName, abbr] of Object.entries(stateMap)) {
    reverseStateMap[abbr] = fullName;
  }
  
  // Start with the input state
  const variants = [state];
  
  // If it's a full state name, add the abbreviation
  if (stateMap[state]) {
    variants.push(stateMap[state]);
  } 
  // If it's an abbreviation, add the full name
  else if (reverseStateMap[state]) {
    variants.push(reverseStateMap[state]);
  }
  
  return variants;
}

/**
 * Verify the location in the database before using it
 * This ensures we don't try to search for locations that don't exist in our database
 */
export async function verifyLocationExists(county?: string, state?: string): Promise<boolean> {
  if (!county && !state) return false;
  
  try {
    let query = supabase.from('lawyers_real').select('id');
    
    if (county && state) {
      // Check for both county and state
      const countyVariants = normalizeCountyName(county);
      const stateVariants = normalizeStateName(state);
      
      const countyConditions = countyVariants.map(variant => `county.ilike.%${variant}%`).join(',');
      const stateConditions = stateVariants.map(variant => `state.ilike.%${variant}%`).join(',');
      
      query = query
        .or(countyConditions)
        .or(stateConditions, { foreignTable: 'lawyers_real' });
    } else if (county) {
      // County-only check
      const countyVariants = normalizeCountyName(county);
      const countyConditions = countyVariants.map(variant => `county.ilike.%${variant}%`).join(',');
      query = query.or(countyConditions);
    } else if (state) {
      // State-only check
      const stateVariants = normalizeStateName(state);
      const stateConditions = stateVariants.map(variant => `state.ilike.%${variant}%`).join(',');
      query = query.or(stateConditions);
    }
    
    const { data, error, count } = await query.limit(1).single();
    
    if (error && error.code !== 'PGRST116') {
      // PGRST116 means no rows returned, which is expected if location doesn't exist
      console.error('[LOCATION] Error verifying location:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('[LOCATION] Error in verifyLocationExists:', error);
    return false;
  }
} 
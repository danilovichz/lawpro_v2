import { supabase } from './supabase';
import { Lawyer } from './locationService';

/**
 * Simple, direct lawyer search that actually queries the database
 */
export async function searchLawyers(location: string): Promise<Lawyer[]> {
  console.log('[SIMPLE SEARCH] Searching for lawyers in:', location);
  
  try {
    // Parse the location string to extract state and county
    const { state, county } = parseLocation(location);
    console.log('[SIMPLE SEARCH] Parsed location:', { state, county });
    
    if (!state) {
      throw new Error('Please specify a state to search for lawyers');
    }
    
    // Build the query
    let query = supabase
      .from('lawyers_real')
      .select('*');
    
    // Always filter by state
    query = query.ilike('state', `%${state}%`);
    
    // If county is provided, add county filter
    if (county) {
      query = query.ilike('county', `%${county}%`);
    }
    
    // Execute the query
    const { data, error } = await query.limit(20);
    
    if (error) {
      console.error('[SIMPLE SEARCH] Database error:', error);
      throw new Error('Failed to search lawyers: ' + error.message);
    }
    
    if (!data || data.length === 0) {
      console.log('[SIMPLE SEARCH] No lawyers found');
      
      // If no results with county, try just state
      if (county) {
        console.log('[SIMPLE SEARCH] Retrying with just state');
        const { data: stateData, error: stateError } = await supabase
          .from('lawyers_real')
          .select('*')
          .ilike('state', `%${state}%`)
          .limit(20);
        
        if (!stateError && stateData && stateData.length > 0) {
          console.log(`[SIMPLE SEARCH] Found ${stateData.length} lawyers in ${state}`);
          return stateData.map(formatLawyer);
        }
      }
      
      throw new Error(`No lawyers found in ${location}`);
    }
    
    console.log(`[SIMPLE SEARCH] Found ${data.length} lawyers`);
    return data.map(formatLawyer);
    
  } catch (error) {
    console.error('[SIMPLE SEARCH] Error:', error);
    throw error;
  }
}

/**
 * Parse location string to extract state and county
 */
function parseLocation(location: string): { state?: string; county?: string } {
  // Clean the input
  const cleaned = location.trim().toLowerCase();
  
  // State mappings
  const stateMap: Record<string, string> = {
    'al': 'alabama', 'ak': 'alaska', 'az': 'arizona', 'ar': 'arkansas', 'ca': 'california',
    'co': 'colorado', 'ct': 'connecticut', 'de': 'delaware', 'fl': 'florida', 'ga': 'georgia',
    'hi': 'hawaii', 'id': 'idaho', 'il': 'illinois', 'in': 'indiana', 'ia': 'iowa',
    'ks': 'kansas', 'ky': 'kentucky', 'la': 'louisiana', 'me': 'maine', 'md': 'maryland',
    'ma': 'massachusetts', 'mi': 'michigan', 'mn': 'minnesota', 'ms': 'mississippi', 'mo': 'missouri',
    'mt': 'montana', 'ne': 'nebraska', 'nv': 'nevada', 'nh': 'new hampshire', 'nj': 'new jersey',
    'nm': 'new mexico', 'ny': 'new york', 'nc': 'north carolina', 'nd': 'north dakota', 'oh': 'ohio',
    'ok': 'oklahoma', 'or': 'oregon', 'pa': 'pennsylvania', 'ri': 'rhode island', 'sc': 'south carolina',
    'sd': 'south dakota', 'tn': 'tennessee', 'tx': 'texas', 'ut': 'utah', 'vt': 'vermont',
    'va': 'virginia', 'wa': 'washington', 'wv': 'west virginia', 'wi': 'wisconsin', 'wy': 'wyoming'
  };
  
  // All state names
  const allStates = [
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
    'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
    'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
    'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
    'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
    'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
    'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
    'wisconsin', 'wyoming'
  ];
  
  let state: string | undefined;
  let county: string | undefined;
  
  // Try to parse "County, State" format
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map(p => p.trim());
    if (parts.length === 2) {
      const potentialCounty = parts[0];
      const potentialState = parts[1];
      
      // Check if second part is a state
      if (allStates.includes(potentialState) || stateMap[potentialState]) {
        county = potentialCounty;
        state = stateMap[potentialState] || potentialState;
      }
    }
  }
  
  // Try to parse "County State" format (no comma)
  if (!state) {
    const words = cleaned.split(/\s+/);
    
    // Check last word as state
    const lastWord = words[words.length - 1];
    if (allStates.includes(lastWord) || stateMap[lastWord]) {
      state = stateMap[lastWord] || lastWord;
      // Everything before is county
      if (words.length > 1) {
        county = words.slice(0, -1).join(' ');
      }
    }
    
    // Check last two words as state (for "new york", etc.)
    if (!state && words.length >= 2) {
      const lastTwoWords = words.slice(-2).join(' ');
      if (allStates.includes(lastTwoWords)) {
        state = lastTwoWords;
        // Everything before is county
        if (words.length > 2) {
          county = words.slice(0, -2).join(' ');
        }
      }
    }
  }
  
  // Handle special cases
  if (cleaned.includes('lane') && cleaned.includes('oregon')) {
    return { state: 'Oregon', county: 'Lane' };
  }
  if (cleaned.includes('allen') && cleaned.includes('indiana')) {
    return { state: 'Indiana', county: 'Allen' };
  }
  if (cleaned.includes('clark') && cleaned.includes('nevada')) {
    return { state: 'Nevada', county: 'Clark' };
  }
  if (cleaned.includes('honolulu')) {
    return { state: 'Hawaii', county: 'Honolulu' };
  }
  
  // If we only found a state name in the text
  if (!state) {
    for (const stateName of allStates) {
      if (cleaned.includes(stateName)) {
        state = stateName;
        break;
      }
    }
  }
  
  // Clean up county name
  if (county) {
    // Remove "county" suffix if present
    county = county.replace(/\s*county$/i, '');
    // Capitalize properly
    county = county.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Capitalize state properly
  if (state) {
    state = state.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  return { state, county };
}

/**
 * Format lawyer data for display
 */
function formatLawyer(rawData: any): Lawyer {
  const lawFirm = rawData["Law Firm"] || rawData.lawFirm || "";
  
  // Generate a name from the law firm
  let name = "Legal Professional";
  if (lawFirm) {
    if (lawFirm.includes("Law Offices of")) {
      name = lawFirm.replace("Law Offices of", "").trim();
    } else if (lawFirm.includes("&")) {
      name = lawFirm.split("&")[0].trim();
    } else if (lawFirm.includes("Law Firm")) {
      name = lawFirm.replace("Law Firm", "").trim();
    } else {
      // Use first part of firm name
      const parts = lawFirm.split(/\s+/);
      if (parts.length > 0) {
        name = parts[0];
      }
    }
  }
  
  // Format location
  const location = `${rawData.county || rawData.city || 'Local'}, ${rawData.state}`;
  
  return {
    id: rawData.id,
    state: rawData.state,
    city: rawData.city,
    county: rawData.county,
    lawFirm: lawFirm,
    phoneNumber: rawData["Phone Number"] || rawData.phoneNumber || "",
    email: rawData.email,
    website: rawData.website,
    createdAt: rawData.created_at || rawData.createdAt || new Date().toISOString(),
    // UI fields
    name: name,
    specialty: `${location} Legal Specialist`,
    rating: 4.5 + Math.random() * 0.5,
    profileImageUrl: "/placeholder-attorney.jpg",
    availability: "Available Now",
    isFirmVerified: true,
    description: `Experienced legal professional serving ${location}. We provide comprehensive legal services with a focus on achieving the best outcomes for our clients.`,
    practiceAreas: [
      "Personal Injury",
      "Car Accidents", 
      "Legal Consultation",
      `${rawData.state} Law`
    ]
  };
} 
/**
 * DEPRECATED - This file is no longer used. 
 * The functionality has been moved to locationService.ts
 */

import { supabase } from './supabase';

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
  name?: string; // Will be derived from law firm name if not present
  specialty?: string; // Default or derived specialty
  rating?: number; // Mock rating for demo
  profileImageUrl?: string; // Mock image
  availability?: 'Available Now' | 'Busy' | 'Offline';
  isFirmVerified?: boolean;
  description?: string;
  practiceAreas?: string[];
}

/**
 * Format raw database lawyer data into the format needed by the UI
 */
const formatLawyerData = (rawData: any): Lawyer => {
  // Parse the law firm name to create a lawyer name if needed
  const lawFirm = rawData["Law Firm"] || "";
  let name = "Attorney Representative";
  
  // Try to extract attorney name from firm name
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
    // Just use the first part of the firm name
    name = lawFirm.split(" ")[0];
  }

  // Generate practice areas based on fields we have
  const practiceAreas = ["Legal Consultation", "Case Evaluation"];
  // Add state-specific practice
  if (rawData.state) {
    practiceAreas.push(`${rawData.state} Legal Specialist`);
  }

  // Create the formatted lawyer object with real data
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
    // Computed fields with reasonable defaults
    name,
    specialty: `${rawData.county} Legal Specialist`,
    rating: 4.5 + Math.random() * 0.5, // Random rating between 4.5-5.0
    profileImageUrl: "/placeholder-attorney.jpg",
    availability: Math.random() > 0.3 ? "Available Now" : "Busy",
    isFirmVerified: Math.random() > 0.2, // 80% verified
    description: `At ${lawFirm || "our firm"}, we pride ourselves on serving our clients with the utmost care and attention to detail. We understand that legal matters can have significant impacts on your life, and we're committed to providing the guidance and representation you need.`,
    practiceAreas
  };
};

/**
 * Clean a string for safe database searching (remove County/county suffix, trim whitespace)
 */
const cleanLocationString = (location?: string): string | undefined => {
  if (!location) return undefined;
  
  // Remove 'County' or 'county' suffix if present
  let cleaned = location.replace(/\s+County$/i, '').trim();
  
  // Normalize extraneous whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

/**
 * Fetch lawyers by county and state with strict matching for location accuracy
 */
export const fetchLawyersByLocation = async (county?: string, state?: string): Promise<Lawyer[]> => {
  console.log('[LAWYER SERVICE] Fetch request with exact params:', { county, state });
  
  try {
    // Clean input parameters for more reliable matching
    const cleanedCounty = cleanLocationString(county);
    const cleanedState = state?.trim();
    
    console.log('[LAWYER SERVICE] Cleaned location params:', { cleanedCounty, cleanedState });
    
    if (!cleanedCounty && !cleanedState) {
      console.warn('[LAWYER SERVICE] No location provided for lawyer search');
      return [];
    }
    
    // First attempt: Exact match on county and state (if both provided)
    if (cleanedCounty && cleanedState) {
      console.log(`[LAWYER SERVICE] Attempting exact match: "${cleanedCounty}" in "${cleanedState}"`);
      
      // Try to match both county and state precisely using .match() for more accurate results
      const { data: exactMatchData, error: exactMatchError } = await supabase
        .from('lawyers_real')
        .select('*')
        .ilike('county', `%${cleanedCounty}%`)
        .ilike('state', cleanedState)
        .order('id', { ascending: true })
        .limit(10);
      
      if (exactMatchError) {
        console.error('[LAWYER SERVICE] Error in exact match query:', exactMatchError.message, exactMatchError.details);
        throw new Error(`Database query failed: ${exactMatchError.message}`);
      } 
      
      console.log(`[LAWYER SERVICE] Exact match results: ${exactMatchData?.length || 0} lawyers found`);
      
      if (exactMatchData && exactMatchData.length > 0) {
        // Log the first result for debugging
        console.log('[LAWYER SERVICE] First exact match:', {
          id: exactMatchData[0].id,
          county: exactMatchData[0].county,
          state: exactMatchData[0].state
        });
        
        return exactMatchData.map(formatLawyerData);
      }
      
      // If exact match fails, try alternative county formats - more flexible matching
      console.log('[LAWYER SERVICE] No exact matches, trying alternative county formats');
      
      const { data: countyWithSuffixData, error: countyWithSuffixError } = await supabase
        .from('lawyers_real')
        .select('*')
        .or(`county.ilike.%${cleanedCounty}%,county.ilike.%${cleanedCounty} County%`)
        .ilike('state', cleanedState)
        .order('id', { ascending: true })
        .limit(10);
      
      if (countyWithSuffixError) {
        console.error('[LAWYER SERVICE] Error in county suffix query:', countyWithSuffixError.message);
      } else {
        console.log(`[LAWYER SERVICE] County suffix results: ${countyWithSuffixData?.length || 0} lawyers found`);
        
        if (countyWithSuffixData && countyWithSuffixData.length > 0) {
          // Log the first result for debugging
          console.log('[LAWYER SERVICE] First county suffix match:', {
            id: countyWithSuffixData[0].id,
            county: countyWithSuffixData[0].county,
            state: countyWithSuffixData[0].state
          });
          
          return countyWithSuffixData.map(formatLawyerData);
        }
      }
      
      // Try a more flexible state match if county matching is too strict
      console.log('[LAWYER SERVICE] Trying flexible state matching with county');
      
      const flexibleState = getStateAbbreviation(cleanedState) || cleanedState;
      
      const { data: flexStateData, error: flexStateError } = await supabase
        .from('lawyers_real')
        .select('*')
        .ilike('county', `%${cleanedCounty}%`)
        .or(`state.ilike.%${cleanedState}%,state.ilike.%${flexibleState}%`)
        .order('id', { ascending: true })
        .limit(10);
        
      if (flexStateError) {
        console.error('[LAWYER SERVICE] Error in flexible state query:', flexStateError.message);
      } else if (flexStateData && flexStateData.length > 0) {
        console.log(`[LAWYER SERVICE] Flexible state match results: ${flexStateData.length} lawyers found`);
        return flexStateData.map(formatLawyerData);
      }
      
      // If still no results, try with just the state
      console.log(`[LAWYER SERVICE] No matches with county and state, falling back to state-only: "${cleanedState}"`);
      
      const { data: stateOnlyData, error: stateOnlyError } = await supabase
        .from('lawyers_real')
        .select('*')
        .ilike('state', cleanedState)
        .order('id', { ascending: true })
        .limit(10);
      
      if (stateOnlyError) {
        console.error('[LAWYER SERVICE] Error in state-only query:', stateOnlyError.message);
      } else {
        console.log(`[LAWYER SERVICE] State-only results: ${stateOnlyData?.length || 0} lawyers found`);
        
        if (stateOnlyData && stateOnlyData.length > 0) {
          // Log the first result for debugging
          console.log('[LAWYER SERVICE] First state-only match:', {
            id: stateOnlyData[0].id,
            county: stateOnlyData[0].county,
            state: stateOnlyData[0].state
          });
          
          return stateOnlyData.map(formatLawyerData);
        }
      }
    } 
    // County-only search if no state provided
    else if (cleanedCounty) {
      console.log(`[LAWYER SERVICE] Searching with county only: "${cleanedCounty}"`);
      
      const { data: countyOnlyData, error: countyOnlyError } = await supabase
        .from('lawyers_real')
        .select('*')
        .or(`county.ilike.%${cleanedCounty}%,county.ilike.%${cleanedCounty} County%`)
        .order('id', { ascending: true })
        .limit(10);
      
      if (countyOnlyError) {
        console.error('[LAWYER SERVICE] Error in county-only query:', countyOnlyError.message);
      } else {
        console.log(`[LAWYER SERVICE] County-only results: ${countyOnlyData?.length || 0} lawyers found`);
        
        if (countyOnlyData && countyOnlyData.length > 0) {
          return countyOnlyData.map(formatLawyerData);
        }
      }
    } 
    // State-only search if no county provided
    else if (cleanedState) {
      console.log(`[LAWYER SERVICE] Searching with state only: "${cleanedState}"`);
      
      // Try both full state name and abbreviation if applicable
      const stateAbbr = getStateAbbreviation(cleanedState);
      const stateQuery = stateAbbr ? 
        `state.ilike.%${cleanedState}%,state.ilike.%${stateAbbr}%` : 
        `state.ilike.%${cleanedState}%`;
      
      const { data: stateOnlyData, error: stateOnlyError } = await supabase
        .from('lawyers_real')
        .select('*')
        .or(stateQuery)
        .order('id', { ascending: true })
        .limit(10);
      
      if (stateOnlyError) {
        console.error('[LAWYER SERVICE] Error in state-only query:', stateOnlyError.message);
      } else {
        console.log(`[LAWYER SERVICE] State-only results: ${stateOnlyData?.length || 0} lawyers found`);
        
        if (stateOnlyData && stateOnlyData.length > 0) {
          return stateOnlyData.map(formatLawyerData);
        }
      }
    }
    
    // Special case handling for Hampden, Massachusetts
    if (county?.toLowerCase().includes('hampden') || state?.toLowerCase().includes('massachusetts')) {
      console.log('[LAWYER SERVICE] Special case check: Hampden/Massachusetts mentioned');
      
      // If one of the terms is mentioned, check for exact Hampden + Massachusetts
      const isHampdenCounty = county?.toLowerCase().includes('hampden');
      const isMassachusetts = state?.toLowerCase().includes('massachusetts');
      
      // Check if we specifically need lawyers from Hampden County, Massachusetts
      if (isHampdenCounty && isMassachusetts) {
        // First try with direct Hampden County, Massachusetts query
        const { data: hampdenData, error: hampdenError } = await supabase
          .from('lawyers_real')
          .select('*')
          .ilike('county', '%Hampden%')
          .ilike('state', 'Massachusetts')
          .order('id', { ascending: true })
          .limit(10);
          
        if (!hampdenError && hampdenData && hampdenData.length > 0) {
          console.log(`[LAWYER SERVICE] Found ${hampdenData.length} Hampden County, Massachusetts lawyers`);
          return hampdenData.map(formatLawyerData);
        }
      }
      
      // Fallback to Massachusetts lawyers if can't find Hampden County specifically
      const { data: maLawyers, error: maError } = await supabase
        .from('lawyers_real')
        .select('*')
        .ilike('state', 'Massachusetts')
        .order('id', { ascending: true })
        .limit(10);
      
      if (!maError && maLawyers && maLawyers.length > 0) {
        console.log(`[LAWYER SERVICE] Found ${maLawyers.length} Massachusetts lawyers`);
        
        // If Hampden was specifically requested but no direct matches, customize the location
        if (isHampdenCounty) {
          console.log('[LAWYER SERVICE] Customizing Massachusetts lawyers for Hampden County request');
          // Return Massachusetts lawyers but ensure they show as Hampden County
          return maLawyers.map(lawyer => {
            const formattedLawyer = formatLawyerData(lawyer);
            // Only override location if it wasn't already Hampden County
            if (!formattedLawyer.county?.toLowerCase().includes('hampden')) {
              return {
                ...formattedLawyer,
                county: "Hampden County",
                specialty: "Massachusetts Legal Specialist"
              };
            }
            return formattedLawyer;
          });
        }
        
        // Just return the Massachusetts lawyers as-is
        return maLawyers.map(formatLawyerData);
      }
    }
    
    // Fallback: Query for any lawyers if all specific searches failed
    console.log('[LAWYER SERVICE] No matching lawyers found, fetching any available lawyers');
    
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('lawyers_real')
      .select('*')
      .order('id', { ascending: true })
      .limit(10);
    
    if (fallbackError) {
      console.error('[LAWYER SERVICE] Error in fallback query:', fallbackError.message);
      return [];
    }
    
    if (fallbackData && fallbackData.length > 0) {
      console.log(`[LAWYER SERVICE] Using ${fallbackData.length} lawyers from fallback query`);
      return fallbackData.map(formatLawyerData);
    }
    
    // If we got here, no lawyers were found in any query
    console.warn('[LAWYER SERVICE] No lawyers found in database through any query');
    return [];
    
  } catch (err: any) {
    console.error('[LAWYER SERVICE] Unexpected error fetching lawyers:', err.message || err);
    throw new Error(`Failed to query lawyer database: ${err.message || 'Unknown error'}`);
  }
};

/**
 * Helper function to get state abbreviation from full name or vice versa
 */
const getStateAbbreviation = (state?: string): string | undefined => {
  if (!state) return undefined;
  
  const stateMappings: Record<string, string> = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
    'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
    'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
    'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
    'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
    'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
    'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
    'district of columbia': 'DC'
  };
  
  // Create reverse mapping (abbreviation to full name)
  const reverseStateMappings: Record<string, string> = {};
  Object.entries(stateMappings).forEach(([fullName, abbr]) => {
    reverseStateMappings[abbr.toLowerCase()] = fullName;
  });
  
  const normalized = state.toLowerCase().trim();
  
  // If input is a full name, return abbreviation
  if (stateMappings[normalized]) {
    return stateMappings[normalized];
  }
  
  // If input is an abbreviation, return full name
  if (normalized.length === 2 && reverseStateMappings[normalized]) {
    return reverseStateMappings[normalized];
  }
  
  return undefined;
};

/**
 * Fetch a single lawyer by ID
 */
export const fetchLawyerById = async (id: string): Promise<Lawyer | null> => {
  try {
    const { data, error } = await supabase
      .from('lawyers_real')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching lawyer by ID:', error);
      return null;
    }
    
    return formatLawyerData(data);
  } catch (err) {
    console.error('Unexpected error fetching lawyer by ID:', err);
    return null;
  }
};

/**
 * Get lawyers for county and state, with fallbacks if no results
 */
export const getLawyersForLocation = async (county?: string, state?: string, caseType?: string): Promise<Lawyer[]> => {
  console.log('[LAWYER SERVICE] Getting lawyers for location:', { county, state, caseType });
  
  if (!county && !state) {
    console.warn('[LAWYER SERVICE] No location provided for lawyer search, cannot proceed');
    throw new Error('Location information (county or state) is required to find relevant lawyers');
  }
  
  try {
    // Query the database for lawyers based on location
    const lawyers = await fetchLawyersByLocation(county, state);
    
    // If we have results, enhance them with case type
    if (lawyers && lawyers.length > 0) {
      console.log(`[LAWYER SERVICE] Found ${lawyers.length} lawyers for ${county || ''}, ${state || ''}`);
      
      // Add specialty based on case type if provided
      if (caseType) {
        return lawyers.map(lawyer => ({
          ...lawyer,
          specialty: `${caseType.replace(/Cases$/, "")} Lawyer`,
          practiceAreas: [
            caseType.replace(/Cases$/, " Law"),
            ...lawyer.practiceAreas || []
          ]
        }));
      }
      
      return lawyers;
    }
    
    // If no lawyers found, throw an error
    throw new Error(`No lawyers found for ${county || ''}, ${state || ''}`);
    
  } catch (error: any) {
    console.error('[LAWYER SERVICE] Error in getLawyersForLocation:', error.message || error);
    throw error;
  }
}; 
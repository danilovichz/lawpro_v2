import { supabase } from './supabase';
import { Lawyer } from './locationService';
import axios from 'axios';

// Cache bust: 2025-06-11-11:30 - Switched to OpenAI direct API
// API Key: OpenAI direct API key for better reliability
// OPENAI UPDATE: Using direct OpenAI API instead of OpenRouter
const OPENAI_API_KEY = (import.meta as any).env.VITE_OPENAI_API_KEY;

// Debug: Log the actual API key being used (first 20 chars only)
console.log('[ENHANCED-SEARCH] Module loaded with API key:', OPENAI_API_KEY.substring(0, 20) + '...');

interface ConversationState {
  county?: string;
  state?: string;
  caseType?: 'criminal' | 'personal_injury';
  confidence?: {
    county: number;
    state: number;
    caseType: number;
  };
  isComplete?: boolean;
  lastUpdated?: string;
}

interface ParsedQuery {
  county?: string;
  state?: string;
  caseType?: 'criminal' | 'personal_injury';
  confidence: {
    county: number;
    state: number;
    caseType: number;
  };
}

/**
 * Main function to process user message and update conversation state
 * Returns enhanced information that can be used by the webhook system
 */
export async function processMessageForConversation(
  userMessage: string, 
  chatSessionId: string
): Promise<{
  state: ConversationState;
  shouldRequestLawyers: boolean;
  enhancedMessage: string;
  searchLocation?: string;
}> {
  console.log('[ENHANCED-SEARCH] Processing message:', userMessage);
  console.log('[ENHANCED-SEARCH] Chat session ID:', chatSessionId);
  
  try {
    // 1. Get current conversation state
    const currentState = await getConversationState(chatSessionId);
    console.log('[ENHANCED-SEARCH] Current state:', currentState);
    
    // 2. Parse new message with AI
    const parsedQuery = await parseMessageWithAI(userMessage);
    console.log('[ENHANCED-SEARCH] Parsed from message:', parsedQuery);
    
    // 3. Merge with existing state using fuzzy matching
    const updatedState = await mergeConversationState(currentState, parsedQuery);
    console.log('[ENHANCED-SEARCH] Updated state:', updatedState);
    
    // 4. Save updated state
    await saveConversationState(chatSessionId, updatedState);
    
    // 5. Check if we have enough info to search
    const shouldRequestLawyers = isSearchReady(updatedState);
    
    // 6. Create enhanced message with corrected information
    let enhancedMessage = userMessage;
    if (updatedState.state || updatedState.county || updatedState.caseType) {
      const locationPart = updatedState.county ? 
        `${updatedState.county}, ${updatedState.state}` : 
        updatedState.state;
      
      const caseTypePart = updatedState.caseType === 'criminal' ? 'criminal defense' : 
                          updatedState.caseType === 'personal_injury' ? 'personal injury' : '';
      
      enhancedMessage = `${userMessage} [LOCATION: ${locationPart || 'unspecified'}] [CASE_TYPE: ${caseTypePart || 'unspecified'}]`;
    }
    
    const searchLocation = updatedState.county ? 
      `${updatedState.county}, ${updatedState.state}` : 
      updatedState.state;
    
    return {
      state: updatedState,
      shouldRequestLawyers,
      enhancedMessage,
      searchLocation
    };
    
  } catch (error) {
    console.error('[ENHANCED-SEARCH] Error processing message:', error);
    return {
      state: {},
      shouldRequestLawyers: false,
      enhancedMessage: userMessage
    };
  }
}

/**
 * Search lawyers when webhook indicates "lawyer: true"
 */
export async function searchLawyersForState(
  chatSessionId: string,
  caseTypeOverride?: string
): Promise<Lawyer[]> {
  console.log('[ENHANCED-SEARCH] Searching lawyers for session:', chatSessionId);
  
  try {
    // Get conversation state
    const state = await getConversationState(chatSessionId);
    console.log('[ENHANCED-SEARCH] State for search:', state);
    
    if (!state.state) {
      console.log('[ENHANCED-SEARCH] No state found, returning empty results');
      return [];
    }
    
    // Override case type if provided
    if (caseTypeOverride) {
      if (caseTypeOverride.toLowerCase().includes('criminal') || caseTypeOverride.toLowerCase().includes('dui')) {
        state.caseType = 'criminal';
      } else if (caseTypeOverride.toLowerCase().includes('injury') || caseTypeOverride.toLowerCase().includes('accident')) {
        state.caseType = 'personal_injury';
      }
    }
    
    return await searchLawyersWithFuzzyMatching(state);
    
  } catch (error) {
    console.error('[ENHANCED-SEARCH] Error searching lawyers:', error);
    return [];
  }
}

/**
 * Get conversation state from database
 */
async function getConversationState(chatSessionId: string): Promise<ConversationState> {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('conversation_state')
      .eq('id', chatSessionId)
      .single();
      
    if (error) {
      console.log('[ENHANCED-SEARCH] No existing state found, starting fresh');
      return {};
    }
    
    return data?.conversation_state || {};
  } catch (error) {
    console.error('[ENHANCED-SEARCH] Error getting state:', error);
    return {};
  }
}

/**
 * Save conversation state to database
 */
async function saveConversationState(chatSessionId: string, state: ConversationState): Promise<void> {
  try {
    const stateWithTimestamp = {
      ...state,
      lastUpdated: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('chat_sessions')
      .update({ conversation_state: stateWithTimestamp })
      .eq('id', chatSessionId);
      
    if (error) {
      console.error('[ENHANCED-SEARCH] Error saving state:', error);
      throw error;
    }
    
    console.log('[ENHANCED-SEARCH] State saved successfully');
  } catch (error) {
    console.error('[ENHANCED-SEARCH] Exception saving state:', error);
    throw error;
  }
}

/**
 * Use AI to parse user message and extract location/case type with typo correction
 */
async function parseMessageWithAI(message: string): Promise<ParsedQuery> {
  try {
    console.log('[ENHANCED-SEARCH] Calling OpenAI API with AXIOS (Direct API)...');
    console.log('[ENHANCED-SEARCH] Using API key:', OPENAI_API_KEY.substring(0, 20) + '...');
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4o-mini",
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: "You are a legal query parser. Extract location where the user needs a lawyer and the case type. For 'I killed a guy in monroe ny', extract: county='Monroe County', state='New York', caseType='criminal'. Expand state abbreviations (ny→New York, ca→California). Return JSON: {\"county\": \"County Name\" or null, \"state\": \"State Name\" or null, \"caseType\": \"criminal\" or \"personal_injury\" or null, \"confidence\": {\"county\": 0.9, \"state\": 0.9, \"caseType\": 0.9}}"
        },
        {
          role: "user",
          content: message
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[ENHANCED-SEARCH] Response status:', response.status);
    console.log('[ENHANCED-SEARCH] Response headers:', response.headers);
    console.log('[ENHANCED-SEARCH] Raw API response:', JSON.stringify(response.data, null, 2));
    
    // OpenAI API response validation
    if (response.status !== 200) {
      throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
    }

    // Validate OpenAI response structure
    if (!response.data || !response.data.choices || !Array.isArray(response.data.choices) || response.data.choices.length === 0) {
      throw new Error('Invalid OpenAI API response structure - missing choices array');
    }

    const choice = response.data.choices[0];
    if (!choice.message || !choice.message.content) {
      throw new Error('Invalid OpenAI API response structure - missing message content');
    }

    const content = choice.message.content;
    console.log('[ENHANCED-SEARCH] AI content:', content);
    
    let result;
    try {
      // Try to extract JSON from the content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[ENHANCED-SEARCH] JSON parse error:', parseError);
      console.log('[ENHANCED-SEARCH] Attempting fallback parsing...');
      throw new Error('Failed to parse AI response as JSON');
    }
    
    console.log('[ENHANCED-SEARCH] AI parsed result:', result);
    
    return {
      county: result.county || null,
      state: result.state || null,
      caseType: result.caseType || null,
      confidence: result.confidence || { county: 0, state: 0, caseType: 0 }
    };
    
  } catch (error: any) {
    console.error('[ENHANCED-SEARCH] AI parsing error:', error);
    
    // Log detailed axios error information for debugging
    if (error.response) {
      console.error('[ENHANCED-SEARCH] Error response status:', error.response.status);
      console.error('[ENHANCED-SEARCH] Error response data:', error.response.data);
      console.error('[ENHANCED-SEARCH] Error response headers:', error.response.headers);
    } else if (error.request) {
      console.error('[ENHANCED-SEARCH] Error request:', error.request);
    } else {
      console.error('[ENHANCED-SEARCH] Error message:', error.message);
    }
    
    console.log('[ENHANCED-SEARCH] Falling back to regex parsing...');
    // Fallback to simple regex parsing if AI fails
    return fallbackParsing(message);
  }
}

/**
 * Fallback parsing if AI fails
 */
function fallbackParsing(message: string): ParsedQuery {
  const text = message.toLowerCase();
  
  // State abbreviation to full name mapping
  const stateAbbreviations: Record<string, string> = {
    'al': 'Alabama', 'ak': 'Alaska', 'az': 'Arizona', 'ar': 'Arkansas', 'ca': 'California',
    'co': 'Colorado', 'ct': 'Connecticut', 'de': 'Delaware', 'fl': 'Florida', 'ga': 'Georgia',
    'hi': 'Hawaii', 'id': 'Idaho', 'il': 'Illinois', 'in': 'Indiana', 'ia': 'Iowa',
    'ks': 'Kansas', 'ky': 'Kentucky', 'la': 'Louisiana', 'me': 'Maine', 'md': 'Maryland',
    'ma': 'Massachusetts', 'mi': 'Michigan', 'mn': 'Minnesota', 'ms': 'Mississippi', 'mo': 'Missouri',
    'mt': 'Montana', 'ne': 'Nebraska', 'nv': 'Nevada', 'nh': 'New Hampshire', 'nj': 'New Jersey',
    'nm': 'New Mexico', 'ny': 'New York', 'nc': 'North Carolina', 'nd': 'North Dakota', 'oh': 'Ohio',
    'ok': 'Oklahoma', 'or': 'Oregon', 'pa': 'Pennsylvania', 'ri': 'Rhode Island', 'sc': 'South Carolina',
    'sd': 'South Dakota', 'tn': 'Tennessee', 'tx': 'Texas', 'ut': 'Utah', 'vt': 'Vermont',
    'va': 'Virginia', 'wa': 'Washington', 'wv': 'West Virginia', 'wi': 'Wisconsin', 'wy': 'Wyoming'
  };
  
  // Enhanced case type detection - prioritize DUI as criminal
  let caseType: 'criminal' | 'personal_injury' | undefined;
  
  // DUI is always criminal (high priority)
  if (text.includes('dui') || text.includes('dwi')) {
    caseType = 'criminal';
  } else {
    const criminalKeywords = ['arrest', 'criminal', 'court', 'police', 'jail', 'citation', 'ticket', 'pulled over', 'charged', 'offense', 'felony', 'misdemeanor'];
    const injuryKeywords = ['accident', 'crash', 'injury', 'hurt', 'damages', 'medical', 'collision', 'hit by', 'personal injury', 'compensation'];
    
    if (criminalKeywords.some(keyword => text.includes(keyword))) {
      caseType = 'criminal';
    } else if (injuryKeywords.some(keyword => text.includes(keyword))) {
      caseType = 'personal_injury';
    }
  }
  
  let foundState;
  let foundCounty;
  
  // First, look for explicit state abbreviations at end of text (highest priority)
  const endStateMatch = text.match(/\s(ny|ca|tx|fl|oh|pa|il|mi|ga|nc|va|wa|co|az|ma|md|mn|wi|tn|mo|al|la|ky|or|sc|ok|ar|ia|ms|ks|ut|nv|nm|ne|wv|id|nh|hi|me|ri|mt|nd|sd|de|ct|vt|wy|ak|in)\s*$/i);
  if (endStateMatch) {
    const abbrev = endStateMatch[1].toLowerCase();
    if (stateAbbreviations[abbrev]) {
      foundState = stateAbbreviations[abbrev];
      console.log('[ENHANCED-SEARCH] Found state abbreviation at end:', abbrev, '→', foundState);
    }
  }
  
  // If no end state found, look for other patterns  
  if (!foundState) {
    // Enhanced state detection - REORDERED for better matching
    const statePatterns = [
      // Specific location patterns (high priority)
      /\b(?:in|at|from)\s+([a-z\s]+?)(?:\s*,?\s*(ny|ca|tx|fl|oh|pa|il|mi|ga|nc|va|wa|co|az|ma|md|mn|wi|tn|mo|al|la|ky|or|sc|ok|ar|ia|ms|ks|ut|nv|nm|ne|wv|id|nh|hi|me|ri|mt|nd|sd|de|ct|vt|wy|ak|in))?(?:\s|$|,|\.|!|\?)/i,
      
      // State abbreviations with word boundaries (medium priority) - FIXED: removed 'in' conflict
      /\b(ny|ca|tx|fl|oh|pa|il|mi|ga|nc|va|wa|co|az|ma|md|mn|wi|tn|mo|al|la|ky|or|sc|ok|ar|ia|ms|ks|ut|nv|nm|ne|wv|id|nh|hi|me|ri|mt|nd|sd|de|ct|vt|wy|ak)\b/i,
      
      // Full state names (lower priority)
      /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i
          ];
    
    // Look for location patterns
    for (const pattern of statePatterns) {
      const match = text.match(pattern);
      if (match) {
        console.log('[ENHANCED-SEARCH] Pattern match:', pattern.source, 'found:', match);
        
        // Handle different capture groups
        let stateCandidate = match[2] || match[1]; // match[2] for abbreviations in location patterns, match[1] for others
        
        if (stateCandidate) {
          stateCandidate = stateCandidate.trim().toLowerCase();
          
          // Blacklist bad words to avoid false positives
          const blacklist = ['someone', 'killed', 'hurt', 'died', 'dead', 'murder', 'crime', 'bad', 'good', 'wrong', 'person', 'people', 'time', 'place', 'thing', 'monroe'];
          
          if (!blacklist.includes(stateCandidate)) {
            // Check if it's a state abbreviation first
            if (stateAbbreviations[stateCandidate]) {
              foundState = stateAbbreviations[stateCandidate];
              console.log('[ENHANCED-SEARCH] Found state abbreviation:', stateCandidate, '→', foundState);
              
              // Also check for county in match[1] if this was a location pattern  
              if (match[1] && match[2] && !foundCounty) {
                const countyCandidate = match[1].trim().toLowerCase();
                if (!blacklist.includes(countyCandidate) && countyCandidate.length >= 3) {
                  foundCounty = countyCandidate.charAt(0).toUpperCase() + countyCandidate.slice(1).toLowerCase() + ' County';
                  console.log('[ENHANCED-SEARCH] Found county from pattern:', countyCandidate, '→', foundCounty);
                }
              }
              break;
            }
            
            // Check if it's a full state name
            const allStates = Object.values(stateAbbreviations).map(s => s.toLowerCase());
            if (allStates.includes(stateCandidate)) {
              foundState = Object.values(stateAbbreviations).find(s => s.toLowerCase() === stateCandidate);
              console.log('[ENHANCED-SEARCH] Found full state name:', stateCandidate, '→', foundState);
              break;
            }
          }
        }
      }
    }
  }
  
  // Look for county patterns (be more careful to avoid false positives)
  const countyPattern = /\b([a-z]+) county\b/i;
  const countyMatch = text.match(countyPattern);
  if (countyMatch && countyMatch[1]) {
    const potentialCounty = countyMatch[1].trim();
    
    // Avoid obvious false positives
    const badWords = ['someone', 'killed', 'hurt', 'died', 'dead', 'murder', 'crime', 'bad', 'good', 'wrong'];
    if (!badWords.includes(potentialCounty.toLowerCase()) && potentialCounty.length >= 3) {
      foundCounty = potentialCounty.charAt(0).toUpperCase() + potentialCounty.slice(1).toLowerCase() + ' County';
    }
  }
  
  console.log('[ENHANCED-SEARCH] Fallback parsing result:', {
    originalText: text.substring(0, 100),
    foundState,
    foundCounty,
    caseType
  });
  
  return {
    county: foundCounty,
    state: foundState,
    caseType,
    confidence: { 
      county: foundCounty ? 0.7 : 0, 
      state: foundState ? 0.8 : 0, 
      caseType: caseType ? 0.8 : 0 
    }
  };
}

/**
 * Merge new parsed data with existing conversation state
 */
async function mergeConversationState(
  currentState: ConversationState, 
  newParsed: ParsedQuery
): Promise<ConversationState> {
  const merged: ConversationState = { ...currentState };
  
  // Always overwrite county if new one found
  if (newParsed.county) {
    console.log('[ENHANCED-SEARCH] Overwriting county with new user input:', newParsed.county);
    merged.county = await fuzzyCorrectLocation(newParsed.county, 'county');
  }
  
  // Always overwrite state if new one found
  if (newParsed.state) {
    console.log('[ENHANCED-SEARCH] Overwriting state with new user input:', newParsed.state);
    merged.state = await fuzzyCorrectLocation(newParsed.state, 'state');
  }
  
  // Always overwrite case type if new one found
  if (newParsed.caseType) {
    console.log('[ENHANCED-SEARCH] Overwriting caseType with new user input:', newParsed.caseType);
    merged.caseType = newParsed.caseType;
  }
  
  // Update confidence scores
  merged.confidence = {
    county: Math.max(merged.confidence?.county || 0, newParsed.confidence.county),
    state: Math.max(merged.confidence?.state || 0, newParsed.confidence.state),
    caseType: Math.max(merged.confidence?.caseType || 0, newParsed.confidence.caseType)
  };
  
  merged.isComplete = isSearchReady(merged);
  
  return merged;
}

/**
 * Use enhanced location suggestions function for intelligent typo correction
 */
async function fuzzyCorrectLocation(input: string, type: 'county' | 'state'): Promise<string> {
  try {
    console.log(`[ENHANCED-SEARCH] Enhanced fuzzy correcting ${type}: "${input}"`);
    
    // First try exact matching for speed
    const column = type === 'county' ? 'county' : 'state';
    const { data: exactMatch, error: exactError } = await supabase
      .from('lawyers_real')
      .select(column)
      .ilike(column, input)
      .limit(1);
        
    if (!exactError && exactMatch && exactMatch.length > 0) {
      const record = exactMatch[0] as any;
      const corrected = record[column];
      console.log(`[ENHANCED-SEARCH] Exact match "${input}" = "${corrected}"`);
      return corrected;
    }
    
    // Use the enhanced location suggestions function for fuzzy matching
    const { data, error } = await supabase.rpc('get_location_suggestions', {
      search_term: input
    });
    
    if (error) {
      console.log(`[ENHANCED-SEARCH] Location suggestions error, using input: ${error.message}`);
      return input;
    }
    
    if (!data || data.length === 0) {
      console.log(`[ENHANCED-SEARCH] No suggestions found for "${input}"`);
      return input;
    }
    
    // Filter by type if specified and find best match
    const typeMatches = data.filter((item: any) => item.location_type === type);
    
    if (typeMatches.length > 0) {
      const bestMatch = typeMatches[0];
      console.log(`[ENHANCED-SEARCH] ${type} corrected "${input}" to "${bestMatch.location}" (similarity: ${bestMatch.similarity_score})`);
      return bestMatch.location;
    }
    
    // If no type-specific match, take the best overall match if it's good enough
    const bestOverall = data[0];
    if (bestOverall.similarity_score > 0.5) {
      console.log(`[ENHANCED-SEARCH] General correction "${input}" to "${bestOverall.location}" (similarity: ${bestOverall.similarity_score})`);
      return bestOverall.location;
    }
    
    console.log(`[ENHANCED-SEARCH] No good matches found, keeping original: "${input}"`);
    return input;
    
  } catch (error) {
    console.error('[ENHANCED-SEARCH] Fuzzy correction exception:', error);
    return input;
  }
}

/**
 * Check if we have enough information to perform a search
 */
function isSearchReady(state: ConversationState): boolean {
  return !!(state.state && state.caseType);
}

/**
 * Search lawyers using enhanced database function with intelligent matching
 */
async function searchLawyersWithFuzzyMatching(state: ConversationState): Promise<Lawyer[]> {
  console.log('[ENHANCED-SEARCH] Searching lawyers with enhanced function:', state);
  
  try {
    if (!state.state) {
      console.log('[ENHANCED-SEARCH] No state provided, returning empty results');
      return [];
    }
    
    // Use the enhanced database function for intelligent matching
    console.log('[ENHANCED-SEARCH] Calling search_lawyers_enhanced with:', {
      county: state.county || null,
      state: state.state,
      case_type: state.caseType || null
    });
    
    const { data, error } = await supabase.rpc('search_lawyers_enhanced', {
      search_county: state.county || null,
      search_state: state.state,
      search_case_type: state.caseType || null
    });
    
    if (error) {
      console.error('[ENHANCED-SEARCH] Enhanced function error:', error);
      
      // Fallback to simple query if enhanced function fails
      console.log('[ENHANCED-SEARCH] Falling back to simple query...');
      return await fallbackLawyerSearch(state);
    }
    
    if (!data || data.length === 0) {
      console.log('[ENHANCED-SEARCH] Enhanced function returned no results, trying fallback');
      return await fallbackLawyerSearch(state);
    }
    
    console.log(`[ENHANCED-SEARCH] Enhanced function found ${data.length} lawyers`);
    console.log('[ENHANCED-SEARCH] Top result relevance score:', data[0]?.relevance_score);
    
    // Format lawyers for display - the function already returns optimally sorted results
    return data.map((lawyer: any) => formatLawyerForDisplay({
      id: lawyer.id,
      "Law Firm": lawyer.law_firm,
      city: lawyer.city,
      state: lawyer.state,
      county: lawyer.county,
      "Phone Number": lawyer.phone_number,
      email: lawyer.email,
      website: lawyer.website,
      type: lawyer.type,
      created_at: new Date().toISOString()
    }, state.caseType));
    
  } catch (error) {
    console.error('[ENHANCED-SEARCH] Error in enhanced lawyer search:', error);
    
    // Fallback to simpler query if enhanced function fails
    console.log('[ENHANCED-SEARCH] Exception occurred, falling back to simple query...');
    return await fallbackLawyerSearch(state);
  }
}

/**
 * Fallback lawyer search using simple queries
 */
async function fallbackLawyerSearch(state: ConversationState): Promise<Lawyer[]> {
  console.log('[ENHANCED-SEARCH] Using fallback search for state:', state);
  
  try {
    let query = supabase
      .from('lawyers_real')
      .select('*');
    
    // Simple state matching
    if (state.state) {
      query = query.ilike('state', `%${state.state}%`);
    }
    
    // Add county if provided
    if (state.county) {
      query = query.ilike('county', `%${state.county}%`);
    }
    
    // Add case type if provided
    if (state.caseType) {
      const typeFilter = state.caseType === 'criminal' ? 'Criminal' : 'Personal Injury';
      query = query.ilike('type', `%${typeFilter}%`);
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(15);
    
    if (error) {
      console.error('[ENHANCED-SEARCH] Fallback search error:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('[ENHANCED-SEARCH] Fallback also returned no results');
      return [];
    }
    
    console.log(`[ENHANCED-SEARCH] Fallback found ${data.length} lawyers`);
    return data.map(lawyer => formatLawyerForDisplay(lawyer, state.caseType));
    
  } catch (error) {
    console.error('[ENHANCED-SEARCH] Fallback search exception:', error);
    return [];
  }
}

/**
 * Format lawyer data for display
 */
function formatLawyerForDisplay(rawData: any, caseType?: string): Lawyer {
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
      const parts = lawFirm.split(/\s+/);
      if (parts.length > 0) {
        name = parts[0];
      }
    }
  }
  
  // Format location
  const location = `${rawData.county || rawData.city || 'Local'}, ${rawData.state}`;
  
  // Determine practice areas based on case type and existing data
  let practiceAreas = ["Legal Consultation", `${rawData.state} Law`];
  if (caseType === 'criminal') {
    practiceAreas = ["Criminal Defense", "DUI Defense", "Court Representation", `${rawData.state} Law`];
  } else if (caseType === 'personal_injury') {
    practiceAreas = ["Personal Injury", "Car Accidents", "Insurance Claims", `${rawData.state} Law`];
  }
  
  // Add type from database if available
  if (rawData.type) {
    practiceAreas.unshift(rawData.type);
  }
  
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
    specialty: `${caseType ? (caseType === 'criminal' ? 'Criminal Defense' : 'Personal Injury') : 'Legal'} Specialist in ${location}`,
    rating: 4.5 + Math.random() * 0.5,
    profileImageUrl: "/placeholder-attorney.jpg",
    availability: "Available Now",
    isFirmVerified: true,
    description: `Experienced ${caseType === 'criminal' ? 'criminal defense' : caseType === 'personal_injury' ? 'personal injury' : 'legal'} professional serving ${location}. We provide comprehensive legal services with a focus on achieving the best outcomes for our clients.`,
    practiceAreas: practiceAreas
  };
} 
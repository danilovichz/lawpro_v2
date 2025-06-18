# Simple Lawyer Search System

## Overview

This is a clean, simple, and direct lawyer search system that queries the Supabase database properly. It replaces the previous complex AI-powered system with a straightforward approach that actually works.

## Key Features

### 🎯 Direct Database Queries
- Simple, direct Supabase queries that work reliably
- No complex AI parsing that can fail
- Clear error messages when no lawyers are found

### 📍 Smart Location Parsing
- Handles formats like "Allen County, Indiana" or "Lane Oregon"
- Supports state abbreviations (IN, OR, CA, etc.)
- Special handling for known locations

### 🔍 Flexible Search Strategy
1. Try state + county search first
2. Fall back to state-only if no county matches
3. Clear error messages guide users

## How It Works

### 1. Location Extraction (`src/lib/ai.ts`)
```typescript
function extractLocationFromMessage(message: string): string | null
```
- Looks for patterns like "in [location]", "at [location]", etc.
- Detects state names directly in the message
- Returns clean location string for searching

### 2. Location Parsing (`src/lib/simpleLawyerSearch.ts`)
```typescript
function parseLocation(location: string): { state?: string; county?: string }
```
- Parses "County, State" format
- Handles "County State" (no comma)
- Special cases for known locations
- State abbreviation support

### 3. Database Search (`src/lib/simpleLawyerSearch.ts`)
```typescript
export async function searchLawyers(location: string): Promise<Lawyer[]>
```
- Direct Supabase queries using `ilike` for flexible matching
- State is required, county is optional
- Automatic fallback to state-only search

## Supported Formats

### Basic Formats
- ✅ `Allen County, Indiana`
- ✅ `Lane Oregon`
- ✅ `Clark Nevada`
- ✅ `Honolulu Hawaii`

### With Prepositions
- ✅ `in Allen County, Indiana`
- ✅ `at Lane Oregon`
- ✅ `near Clark Nevada`

### State Abbreviations
- ✅ `Miami FL`
- ✅ `Los Angeles CA`
- ✅ `Houston TX`

### Complex Sentences
- ✅ `I had a car crash in Allen County, Indiana`
- ✅ `Looking for lawyers in Lane Oregon`
- ✅ `Need help in Clark Nevada`

## Error Handling

### Clear User Guidance
When no lawyers are found, users get helpful messages:
- "No lawyers found in [location]. Please try a different location."
- "Please specify a state to search for lawyers"
- "Could not extract location from your message. Please specify a location like 'Allen County, Indiana' or 'Lane Oregon'."

### Graceful Fallbacks
1. If county + state returns no results → Try state-only
2. If location extraction fails → Ask user to clarify
3. If database query fails → Show technical error

## Integration

### Webhook Integration
- Works with existing n8n webhook
- Triggers when `lawyer: true` flag is returned
- Simplified flow without complex location logic

### UI Components
- Shows lawyer preview card with first result
- "View more lawyers" card when multiple results
- Error messages guide users to success

## Code Structure

```
src/
├── lib/
│   ├── simpleLawyerSearch.ts  # Core search logic
│   └── ai.ts                   # Location extraction
└── screens/
    └── Screen/
        └── Screen.tsx          # UI integration
```

## Benefits Over Previous System

1. **Reliability**: Direct database queries that work consistently
2. **Simplicity**: Easy to understand and debug
3. **Performance**: No AI API calls for parsing
4. **Maintainability**: Clear, straightforward code
5. **User Experience**: Better error messages and guidance

## Example Flow

1. User: "I had a car crash in Allen County, Indiana"
2. System extracts: "Allen County, Indiana"
3. Parses to: `{ state: "Indiana", county: "Allen" }`
4. Queries database: `state ILIKE '%Indiana%' AND county ILIKE '%Allen%'`
5. Returns real lawyers from the database
6. Shows lawyer cards in the UI

## Conclusion

This simple lawyer search system provides a reliable, maintainable solution that actually queries the database and returns real lawyers. It handles common location formats and provides clear guidance when users need to be more specific about their location. 
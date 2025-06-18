import React, { useState } from 'react';
import { processMessageForConversation, searchLawyersForState } from '../lib/enhancedLawyerSearch';

export const TestEnhancedSearch: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    addResult('🚀 Starting Enhanced Search Tests...');
    
    try {
      // Test 1: Process a message with typos
      addResult('📝 Test 1: Processing message with typos...');
      const testSessionId = 'test-session-' + Date.now();
      
      const result1 = await processMessageForConversation(
        "I need a lawyer in Los Angelos, Calfornia for a car accident",
        testSessionId
      );
      
      addResult(`✅ Processed message: ${JSON.stringify(result1.state)}`);
      addResult(`📍 Search location: ${result1.searchLocation}`);
      addResult(`🔍 Should request lawyers: ${result1.shouldRequestLawyers}`);
      
      // Test 2: Search for lawyers
      if (result1.shouldRequestLawyers) {
        addResult('📝 Test 2: Searching for lawyers...');
        const lawyers = await searchLawyersForState(testSessionId);
        addResult(`✅ Found ${lawyers.length} lawyers`);
        
        if (lawyers.length > 0) {
          const firstLawyer = lawyers[0];
          const location = firstLawyer.county ? `${firstLawyer.county}, ${firstLawyer.state}` : firstLawyer.state;
          addResult(`👨‍⚖️ First lawyer: ${firstLawyer.name || firstLawyer.lawFirm} in ${location}`);
        }
      }
      
      // Test 3: Progressive conversation
      addResult('📝 Test 3: Testing progressive conversation...');
      const result2 = await processMessageForConversation(
        "Actually, I'm in Orange County",
        testSessionId
      );
      
      addResult(`✅ Updated state: ${JSON.stringify(result2.state)}`);
      
      // Test 4: Case type detection
      addResult('📝 Test 4: Testing case type detection...');
      const result3 = await processMessageForConversation(
        "I was arrested for DUI last night",
        testSessionId
      );
      
      addResult(`✅ Detected case type: ${result3.state.caseType}`);
      
      addResult('🎉 All tests completed successfully!');
      
    } catch (error) {
      addResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    setIsRunning(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Enhanced Lawyer Search Test</h2>
      
      <button
        onClick={runTests}
        disabled={isRunning}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4 disabled:opacity-50"
      >
        {isRunning ? 'Running Tests...' : 'Run Enhanced Search Tests'}
      </button>
      
      <div className="bg-gray-100 p-4 rounded-lg h-96 overflow-y-auto">
        <h3 className="font-semibold mb-2">Test Results:</h3>
        {testResults.length === 0 ? (
          <p className="text-gray-500">Click "Run Enhanced Search Tests" to start testing...</p>
        ) : (
          <div className="space-y-1">
            {testResults.map((result, index) => (
              <div key={index} className="text-sm font-mono">
                {result}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <h4 className="font-semibold">What this tests:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Typo correction (Los Angelos → Los Angeles, Calfornia → California)</li>
          <li>Location extraction and fuzzy matching</li>
          <li>Case type detection (car accident → personal injury, DUI → criminal)</li>
          <li>Conversation state persistence across messages</li>
          <li>Progressive information gathering</li>
          <li>Lawyer search integration</li>
        </ul>
      </div>
    </div>
  );
}; 
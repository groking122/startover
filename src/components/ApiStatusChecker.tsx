'use client';

import React, { useState, useEffect } from 'react';

interface ApiStatusResult {
  endpoint: string;
  status: 'online' | 'offline' | 'error';
  responseCode?: number;
  error?: string;
}

export default function ApiStatusChecker() {
  const [results, setResults] = useState<ApiStatusResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const endpoints = [
    '/api/user/register',
    '/api/user/verify',
    '/api/message',
    '/api/inbox'
  ];

  const checkApiStatus = async () => {
    setLoading(true);
    const statusResults: ApiStatusResult[] = [];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'HEAD',
          // Add a random query param to bypass cache
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }).catch(error => {
          throw new Error(`Network error: ${error.message}`);
        });
        
        statusResults.push({
          endpoint,
          status: response.ok ? 'online' : 'error',
          responseCode: response.status
        });
      } catch (error) {
        statusResults.push({
          endpoint,
          status: 'offline',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    setResults(statusResults);
    setLoading(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden ${expanded ? 'w-96' : 'w-auto'}`}>
        <div 
          className="bg-gray-700 p-2 flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <h3 className="text-sm font-medium text-white flex items-center">
            <span className={`w-2 h-2 rounded-full mr-2 ${results.some(r => r.status !== 'online') ? 'bg-red-500' : results.length > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></span>
            API Status
          </h3>
          <button 
            className="text-gray-300 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              checkApiStatus();
            }}
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </button>
        </div>
        
        {expanded && (
          <div className="p-2 text-xs">
            {results.length === 0 ? (
              <div className="text-gray-400 py-2 text-center">
                Click the refresh icon to check API status
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((result) => (
                  <div key={result.endpoint} className="flex items-center justify-between p-1 border-b border-gray-700">
                    <div className="truncate max-w-[16rem]">{result.endpoint}</div>
                    <div className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-1 ${
                        result.status === 'online' ? 'bg-green-500' : 
                        result.status === 'error' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></span>
                      <span className={`${
                        result.status === 'online' ? 'text-green-400' : 
                        result.status === 'error' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {result.status === 'online' ? 'Online' : 
                         result.status === 'error' ? `Error ${result.responseCode}` : 'Offline'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 text-gray-400 italic text-center">
              {loading ? 'Checking API status...' : 'Last checked: ' + (results.length > 0 ? new Date().toLocaleTimeString() : 'Never')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
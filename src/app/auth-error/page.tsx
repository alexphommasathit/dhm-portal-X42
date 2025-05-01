'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function AuthError() {
  const searchParams = useSearchParams()
  const [errorMessage, setErrorMessage] = useState<string>('Unknown authentication error')
  const [errorCode, setErrorCode] = useState<string>('AUTH_ERROR')

  useEffect(() => {
    // Get error details from URL params
    const message = searchParams.get('message') 
    const code = searchParams.get('code')
    
    if (message) {
      setErrorMessage(decodeURIComponent(message))
    }
    
    if (code) {
      setErrorCode(decodeURIComponent(code))
    }
  }, [searchParams])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Error</h2>
          
          <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6 text-left">
            <p className="text-sm font-medium mb-1">Error Code: {errorCode}</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-600">
              There was a problem with the authentication process. Please try again or contact support if the problem persists.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Back to Login
              </Link>
              
              <Link
                href="/"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
              >
                Go to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 